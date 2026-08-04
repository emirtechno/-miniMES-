using FluentValidation;
using Microsoft.AspNetCore.Mvc;
using MiniMesApi.Controllers;
using MiniMesApi.DTOs;
using MiniMesApi.Models;
using MiniMesApi.Services;

namespace MiniMesApi.Tests;

/// <summary>K1 — GetSummary shiftCode/since SQL-path filters exclude prior-shift ticks.</summary>
public sealed class GetSummaryFilterTests
{
    [Fact]
    public async Task GetSummary_with_shiftCode_and_since_excludes_prior_shift_and_older_ticks()
    {
        await using var db = TestDb.CreateContext();
        var station = StationCatalog.AssemblyLine1;
        var shiftStart = new DateTimeOffset(2026, 8, 4, 6, 0, 0, TimeSpan.Zero);

        db.MachineMetrics.AddRange(
            // Prior shift — must not mix into SHIFT_A window
            Metric(station, ShiftCatalog.ShiftC, shiftStart.AddHours(-2), actual: 200, good: 180),
            // Same shift but before `since`
            Metric(station, ShiftCatalog.ShiftA, shiftStart.AddMinutes(-30), actual: 100, good: 90),
            // In window
            Metric(station, ShiftCatalog.ShiftA, shiftStart.AddMinutes(10), actual: 120, good: 115),
            Metric(station, ShiftCatalog.ShiftA, shiftStart.AddMinutes(20), actual: 80, good: 78),
            // Other station in window — ignored when stationId set
            Metric(StationCatalog.AssemblyLine2, ShiftCatalog.ShiftA, shiftStart.AddMinutes(15), actual: 50, good: 50));
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        var result = await controller.GetSummary(
            stationId: station,
            shiftCode: ShiftCatalog.ShiftA,
            since: shiftStart);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var rows = Assert.IsAssignableFrom<IReadOnlyList<TelemetrySummaryDto>>(ok.Value);
        var summary = Assert.Single(rows);

        Assert.Equal(station, summary.StationId);
        Assert.Equal(200, summary.Actual); // 120 + 80
        Assert.Equal(193, summary.Good);   // 115 + 78
        Assert.Equal(7, summary.Nok);      // Actual − Good
        Assert.Equal(2, summary.TickCount);
    }

    [Fact]
    public async Task GetSummary_without_filters_aggregates_all_ticks_for_station()
    {
        await using var db = TestDb.CreateContext();
        var station = StationCatalog.PackagingLine1;
        var t0 = DateTimeOffset.UtcNow.AddHours(-3);

        db.MachineMetrics.AddRange(
            Metric(station, ShiftCatalog.ShiftA, t0, 50, 45),
            Metric(station, ShiftCatalog.ShiftB, t0.AddHours(1), 30, 30));
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        var result = await controller.GetSummary(stationId: station);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var rows = Assert.IsAssignableFrom<IReadOnlyList<TelemetrySummaryDto>>(ok.Value);
        var summary = Assert.Single(rows);
        Assert.Equal(80, summary.Actual);
        Assert.Equal(75, summary.Good);
        Assert.Equal(5, summary.Nok);
        Assert.Equal(2, summary.TickCount);
    }

    private static MachineMetricsController CreateController(MesDbContext db)
    {
        var validator = new InlineValidator<CreateMachineMetricDto>();
        return new MachineMetricsController(db, validator, new NoopRealtime(), new NoopLotSync(), new NoopAudit());
    }

    private static MachineMetric Metric(
        string stationId,
        string shiftCode,
        DateTimeOffset recordedAt,
        int actual,
        int good) => new()
    {
        StationId = stationId,
        PlannedProductionSeconds = 300,
        DowntimeSeconds = 0,
        DowntimeReasonCode = DowntimeReasonCatalog.None,
        ShiftCode = shiftCode,
        IdealCycleTimeSeconds = 2,
        ActualProductionCount = actual,
        GoodProductionCount = good,
        RecordedAt = recordedAt
    };

    private sealed class NoopRealtime : IMesRealtimePublisher
    {
        public Task AlarmCreatedAsync(AlarmDto alarm, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;

        public Task AlarmUpdatedAsync(AlarmDto alarm, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;

        public Task AlarmDeletedAsync(int alarmId, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;

        public Task OeeUpdatedAsync(IReadOnlyCollection<OeeMetricDto> metrics, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;
    }

    private sealed class NoopLotSync : ILotTelemetrySync
    {
        public Task ApplyGoodUnitsAsync(string stationId, int goodUnits, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;
    }

    private sealed class NoopAudit : IAuditLogService
    {
        public Task WriteAsync(
            string entityType,
            string entityId,
            string action,
            System.Security.Claims.ClaimsPrincipal? actor,
            string? details = null,
            CancellationToken cancellationToken = default) =>
            Task.CompletedTask;
    }
}
