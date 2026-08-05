using System.Collections.Concurrent;
using Microsoft.EntityFrameworkCore;
using MiniMesApi.DTOs;
using MiniMesApi.Models;

namespace MiniMesApi.Services;

/// <summary>
/// Raises Andon alarms from persisted physical gauges with per-station cooldown.
/// Thresholds: temp ≥ 85 °C, rpm &lt; 500 while producing, vibration ≥ 2.8 mm/s.
/// Cooldown between simulated alarms per station: 15–45 minutes (uniform random seconds), persisted on StationRuntime.
/// </summary>
public interface ITelemetryAnomalyService
{
    Task EvaluateAndRaiseAsync(MachineMetric metric, CancellationToken cancellationToken = default);
}

public sealed class TelemetryAnomalyService(
    MesDbContext context,
    IMesRealtimePublisher realtime,
    IStationRuntimeService runtimeService) : ITelemetryAnomalyService
{
    public const double TemperatureCriticalCelsius = 85;
    public const double RpmLowThreshold = 500;
    public const double VibrationCriticalMmPerSec = 2.8;
    public static readonly TimeSpan MinCooldown = TimeSpan.FromMinutes(15);
    public static readonly TimeSpan MaxCooldown = TimeSpan.FromMinutes(45);

    private static readonly ConcurrentDictionary<string, DateTimeOffset> NextAllowedAtByStation = new(StringComparer.OrdinalIgnoreCase);

    public async Task EvaluateAndRaiseAsync(MachineMetric metric, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(metric);
        if (string.IsNullOrWhiteSpace(metric.StationId)) return;

        // Retired/legacy stations must not raise Andon anomalies (UI + create gate).
        if (!StationCatalog.IsActive(metric.StationId)) return;

        // Downtime / idle ticks must not raise production anomalies.
        if (metric.ActualProductionCount <= 0) return;

        var anomaly = Detect(metric);
        if (anomaly is null) return;

        var now = DateTimeOffset.UtcNow;
        var runtime = await runtimeService.GetOrCreateAsync(metric.StationId, cancellationToken);

        // DB gate survives process restart and works without Redis across instances.
        if (runtime.NextAnomalyAllowedAt is DateTimeOffset dbNext && now < dbNext)
        {
            return;
        }

        if (NextAllowedAtByStation.TryGetValue(metric.StationId, out var nextAllowed) &&
            now < nextAllowed)
        {
            return;
        }

        var hasOpen = await context.Alarms.AsNoTracking()
            .AnyAsync(
                alarm => alarm.Station == metric.StationId
                    && alarm.Status == "Açık"
                    && alarm.Title == anomaly.Title,
                cancellationToken);
        if (hasOpen) return;

        var cooldownUntil = now + NextCooldown();
        NextAllowedAtByStation[metric.StationId] = cooldownUntil;
        runtime.NextAnomalyAllowedAt = cooldownUntil;
        runtime.UpdatedAt = now;

        var alarm = new Alarm
        {
            Title = anomaly.Title,
            Station = metric.StationId,
            Severity = anomaly.Severity,
            Description = anomaly.Description,
            Time = now,
            Status = "Açık"
        };

        context.Alarms.Add(alarm);
        await context.SaveChangesAsync(cancellationToken);

        await runtimeService.PauseForAlarmAsync(metric.StationId, alarm.Title, alarm.Severity, cancellationToken);
        await realtime.AlarmCreatedAsync(ToDto(alarm), cancellationToken);
    }

    /// <summary>Uniform random interval in [MinCooldown, MaxCooldown] with second-level jitter.</summary>
    internal static TimeSpan NextCooldown()
    {
        var span = MaxCooldown - MinCooldown;
        var offset = Random.Shared.NextDouble() * span.TotalSeconds;
        return MinCooldown + TimeSpan.FromSeconds(offset);
    }

    internal static AnomalyCandidate? Detect(MachineMetric metric)
    {
        if (metric.Vibration is >= VibrationCriticalMmPerSec)
        {
            return new AnomalyCandidate(
                "Yüksek Titreşim Eşiği Aşıldı",
                "Kritik",
                $"Titreşim {metric.Vibration:0.00} mm/s ≥ {VibrationCriticalMmPerSec:0.0} mm/s.");
        }

        if (metric.Temperature is >= TemperatureCriticalCelsius)
        {
            return new AnomalyCandidate(
                "Yüksek Sıcaklık",
                "Yüksek",
                $"Sıcaklık {metric.Temperature:0.0} °C ≥ {TemperatureCriticalCelsius:0} °C.");
        }

        var isProducing = metric.ActualProductionCount > 0
            && metric.DowntimeSeconds < metric.PlannedProductionSeconds * 0.5;
        if (isProducing && metric.Rpm is < RpmLowThreshold)
        {
            return new AnomalyCandidate(
                "Düşük RPM (Üretimde)",
                "Yüksek",
                $"RPM {metric.Rpm:0} < {RpmLowThreshold:0} üretim tick'inde.");
        }

        return null;
    }

    private static AlarmDto ToDto(Alarm alarm) => new()
    {
        Id = alarm.Id,
        Title = alarm.Title,
        Station = alarm.Station,
        Severity = alarm.Severity,
        Time = alarm.Time,
        Status = alarm.Status,
        Description = alarm.Description,
        AcknowledgedAt = alarm.AcknowledgedAt,
        AcknowledgedBy = alarm.AcknowledgedBy,
        ResolvedAt = alarm.ResolvedAt,
        ResolvedBy = alarm.ResolvedBy
    };

    internal sealed record AnomalyCandidate(string Title, string Severity, string Description);
}
