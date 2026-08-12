using FluentValidation;
using Microsoft.EntityFrameworkCore;
using MiniMesApi.DTOs;
using MiniMesApi.Models;

namespace MiniMesApi.Services;

// NEDEN: Makine metriği yazmanın tek kapısı. PLC/API ve OEE simülasyonu buradan geçer;
// böylece lot/iş emri ilerlemesi, anomali alarmı ve SignalR yayını her kaynakta aynı sırayla çalışır.
// NASIL: validate → normalize → DB kaydet → ProductionProgressSync (WO iyi adet) → TelemetryAnomaly → SignalR (OEE + telemetry).
public interface IMetricIngestService
{
    Task<MachineMetricDto> IngestAsync(CreateMachineMetricDto dto, CancellationToken cancellationToken = default);
}

public sealed class MetricIngestService(
    MesDbContext context,
    IValidator<CreateMachineMetricDto> validator,
    IProductionProgressSync progressSync,
    ITelemetryAnomalyService anomalyService,
    IMesRealtimePublisher realtime) : IMetricIngestService
{
    public async Task<MachineMetricDto> IngestAsync(
        CreateMachineMetricDto dto,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(dto);

        var validation = await validator.ValidateAsync(dto, cancellationToken);
        if (!validation.IsValid)
        {
            throw new MetricIngestValidationException(validation.Errors
                .GroupBy(error => error.PropertyName)
                .ToDictionary(
                    group => group.Key,
                    group => group.Select(error => error.ErrorMessage).ToArray()));
        }

        var recordedAt = dto.RecordedAt ?? DateTimeOffset.UtcNow;
        // NEDEN: Andon / vardiya-katalog panoları saate göre pencere kullanır. ShiftCode her zaman
        // RecordedAt'tan katalog koduyla basılır — operatörün seçtiği oturum kodu ile ezilmez.
        // Operatör KPI'ları bunun yerine ShiftSessionId üzerinden bağlanır.
        // NASIL: ShiftCatalog.ResolveForUtc(recordedAt) → ShiftCode; açık oturum varsa ShiftSessionId doldurulur.
        var shiftCode = ShiftCatalog.ResolveForUtc(recordedAt);
        var openSession = await context.ShiftSessions.AsNoTracking()
            .Where(session => session.StationId == dto.StationId
                && session.Status != ShiftSessionStatuses.Ended)
            .OrderByDescending(session => session.StartedAt)
            .Select(session => new { session.Id })
            .FirstOrDefaultAsync(cancellationToken);

        var metric = new MachineMetric
        {
            StationId = dto.StationId,
            PlannedProductionSeconds = dto.PlannedProductionSeconds,
            DowntimeSeconds = dto.DowntimeSeconds,
            DowntimeReasonCode = string.IsNullOrWhiteSpace(dto.DowntimeReasonCode)
                ? DowntimeReasonCatalog.None
                : dto.DowntimeReasonCode,
            ShiftCode = shiftCode,
            ShiftSessionId = openSession?.Id,
            IdealCycleTimeSeconds = dto.IdealCycleTimeSeconds,
            ActualProductionCount = dto.ActualProductionCount,
            GoodProductionCount = dto.GoodProductionCount,
            Temperature = dto.Temperature,
            Rpm = dto.Rpm,
            Vibration = dto.Vibration,
            RecordedAt = recordedAt
        };
        MachineMetricInvariants.Normalize(metric);

        context.MachineMetrics.Add(metric);
        await context.SaveChangesAsync(cancellationToken);

        // NEDEN: İyi üretim adedi iş emri CompletedQuantity'ye yansır (WO-only; lot/batch yok).
        // NASIL: progressSync.ApplyGoodUnitsAsync → ardından anomali eşiği kontrolü → canlı panolara OEE + telemetry push.
        await progressSync.ApplyGoodUnitsAsync(metric.StationId, metric.GoodProductionCount, cancellationToken);
        await anomalyService.EvaluateAndRaiseAsync(metric, cancellationToken);

        var dtoOut = ToDto(metric);
        var oee = OeeCalculator.Calculate(metric);
        await realtime.OeeUpdatedAsync([oee], cancellationToken);
        await realtime.TelemetryTickAsync(dtoOut, cancellationToken);

        return dtoOut;
    }

    internal static MachineMetricDto ToDto(MachineMetric metric) => new()
    {
        Id = metric.Id,
        StationId = metric.StationId,
        PlannedProductionSeconds = metric.PlannedProductionSeconds,
        DowntimeSeconds = metric.DowntimeSeconds,
        DowntimeReasonCode = metric.DowntimeReasonCode,
        DowntimeReason = DowntimeReasonCatalog.DisplayName(metric.DowntimeReasonCode),
        ShiftCode = metric.ShiftCode,
        ShiftName = ShiftCatalog.DisplayName(metric.ShiftCode),
        ShiftSessionId = metric.ShiftSessionId,
        IdealCycleTimeSeconds = metric.IdealCycleTimeSeconds,
        ActualProductionCount = metric.ActualProductionCount,
        GoodProductionCount = metric.GoodProductionCount,
        Temperature = metric.Temperature,
        Rpm = metric.Rpm,
        Vibration = metric.Vibration,
        RecordedAt = metric.RecordedAt
    };
}

public sealed class MetricIngestValidationException(IDictionary<string, string[]> errors) : Exception("Metric ingest validation failed.")
{
    public IDictionary<string, string[]> Errors { get; } = errors;
}
