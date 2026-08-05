using MiniMesApi.Models;
using MiniMesApi.Services;

namespace MiniMesApi.Tests;

public sealed class AlarmStatusTests
{
    [Theory]
    [InlineData(AlarmStatuses.Open, true)]
    [InlineData(AlarmStatuses.Acknowledged, true)]
    [InlineData(AlarmStatuses.Resolved, false)]
    [InlineData(AlarmStatuses.ClosedLegacy, false)]
    [InlineData(null, true)]
    public void IsOpen_keeps_acknowledged_visible(string? status, bool expected)
    {
        Assert.Equal(expected, AlarmStatuses.IsOpen(status));
    }
}

public sealed class WorkOrderStatusTests
{
    [Theory]
    [InlineData(WorkOrderStatuses.Waiting, WorkOrderStatuses.InProgress)]
    [InlineData(WorkOrderStatuses.InProgress, WorkOrderStatuses.Completed)]
    public void TryAdvance_moves_forward(string current, string expected)
    {
        Assert.True(WorkOrderStatuses.TryAdvance(current, out var next, out var error));
        Assert.Equal(expected, next);
        Assert.Null(error);
    }

    [Fact]
    public void TryAdvance_rejects_completed_orders()
    {
        Assert.False(WorkOrderStatuses.TryAdvance(WorkOrderStatuses.Completed, out _, out var error));
        Assert.Equal("Tamamlanmış iş emri ilerletilemez.", error);
    }
}

public sealed class MachineMetricInvariantTests
{
    [Fact]
    public void Normalize_clamps_good_count_to_actual()
    {
        var metric = new MachineMetric
        {
            StationId = "Montaj_Hatti_01",
            PlannedProductionSeconds = 100,
            DowntimeSeconds = 10,
            DowntimeReasonCode = DowntimeReasonCatalog.Breakdown,
            ShiftCode = ShiftCatalog.ShiftA,
            IdealCycleTimeSeconds = 1,
            ActualProductionCount = 50,
            GoodProductionCount = 80,
            RecordedAt = DateTimeOffset.UtcNow
        };

        MachineMetricInvariants.Normalize(metric);

        Assert.Equal(50, metric.GoodProductionCount);
        Assert.Equal(DowntimeReasonCatalog.Breakdown, metric.DowntimeReasonCode);
    }

    [Fact]
    public void Normalize_clears_reason_when_no_downtime()
    {
        var metric = new MachineMetric
        {
            StationId = "Montaj_Hatti_01",
            PlannedProductionSeconds = 100,
            DowntimeSeconds = 0,
            DowntimeReasonCode = DowntimeReasonCatalog.Breakdown,
            IdealCycleTimeSeconds = 1,
            ActualProductionCount = 10,
            GoodProductionCount = 10,
            RecordedAt = new DateTimeOffset(2026, 8, 3, 10, 0, 0, TimeSpan.Zero)
        };

        MachineMetricInvariants.Normalize(metric);

        Assert.Equal(DowntimeReasonCatalog.None, metric.DowntimeReasonCode);
        Assert.Equal(ShiftCatalog.ShiftA, metric.ShiftCode);
    }
}
