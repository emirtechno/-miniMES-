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
    [InlineData(WorkOrderStatuses.Completed, WorkOrderStatuses.Archived)]
    public void TryAdvance_moves_forward(string current, string expected)
    {
        Assert.True(WorkOrderStatuses.TryAdvance(current, out var next, out var error));
        Assert.Equal(expected, next);
        Assert.Null(error);
    }

    [Fact]
    public void TryAdvance_rejects_archived_orders()
    {
        Assert.False(WorkOrderStatuses.TryAdvance(WorkOrderStatuses.Archived, out _, out var error));
        Assert.Equal("Arşivlenmiş iş emri ilerletilemez.", error);
    }

    [Fact]
    public void TryRestore_moves_archived_to_completed()
    {
        Assert.True(WorkOrderStatuses.TryRestore(WorkOrderStatuses.Archived, out var next, out var error));
        Assert.Equal(WorkOrderStatuses.Completed, next);
        Assert.Null(error);
    }

    [Theory]
    [InlineData(WorkOrderStatuses.Waiting)]
    [InlineData(WorkOrderStatuses.InProgress)]
    [InlineData(WorkOrderStatuses.Completed)]
    public void TryRestore_rejects_non_archived_orders(string current)
    {
        Assert.False(WorkOrderStatuses.TryRestore(current, out _, out var error));
        Assert.Equal("Yalnızca arşivlenmiş iş emirleri geri alınabilir.", error);
    }

    [Theory]
    [InlineData(WorkOrderStatuses.Waiting, true)]
    [InlineData(WorkOrderStatuses.InProgress, true)]
    [InlineData(WorkOrderStatuses.Completed, true)]
    [InlineData(WorkOrderStatuses.Archived, false)]
    public void IsActiveBoard_excludes_archived(string status, bool expected)
    {
        Assert.Equal(expected, WorkOrderStatuses.IsActiveBoard(status));
    }

    [Fact]
    public void IsVisible_excludes_soft_deleted()
    {
        Assert.True(WorkOrderStatuses.IsVisible(null));
        Assert.False(WorkOrderStatuses.IsVisible(DateTimeOffset.UtcNow));
    }

    [Fact]
    public void Soft_deleted_orders_are_filtered_from_board_lists()
    {
        var orders = new[]
        {
            new WorkOrder { Id = 1, OrderNo = "A", Status = WorkOrderStatuses.Waiting, DeletedAt = null },
            new WorkOrder { Id = 2, OrderNo = "B", Status = WorkOrderStatuses.Archived, DeletedAt = null },
            new WorkOrder { Id = 3, OrderNo = "C", Status = WorkOrderStatuses.Waiting, DeletedAt = DateTimeOffset.UtcNow },
            new WorkOrder { Id = 4, OrderNo = "D", Status = WorkOrderStatuses.Archived, DeletedAt = DateTimeOffset.UtcNow },
        };

        var visible = orders.Where(order => WorkOrderStatuses.IsVisible(order.DeletedAt)).ToArray();
        var active = visible.Where(order => WorkOrderStatuses.IsActiveBoard(order.Status)).Select(o => o.Id).ToArray();
        var history = visible.Where(order => order.Status == WorkOrderStatuses.Archived).Select(o => o.Id).ToArray();

        Assert.Equal(new[] { 1, 2 }, visible.Select(o => o.Id).ToArray());
        Assert.Equal(new[] { 1 }, active);
        Assert.Equal(new[] { 2 }, history);
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
