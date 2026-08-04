using MiniMesApi.Models;
using MiniMesApi.Services;

namespace MiniMesApi.Tests;

public sealed class TelemetryAggregatorTests
{
    [Fact]
    public void Aggregate_sums_actual_good_and_derives_nok_yield()
    {
        var metrics = new[]
        {
            new MachineMetric
            {
                StationId = "Montaj_Hatti_01",
                ActualProductionCount = 128,
                GoodProductionCount = 125,
                DowntimeSeconds = 34,
                RecordedAt = DateTimeOffset.UtcNow.AddMinutes(-2)
            },
            new MachineMetric
            {
                StationId = "Montaj_Hatti_01",
                ActualProductionCount = 100,
                GoodProductionCount = 90,
                DowntimeSeconds = 10,
                RecordedAt = DateTimeOffset.UtcNow
            }
        };

        var summary = TelemetryAggregator.Aggregate(metrics, "Montaj_Hatti_01");

        Assert.Equal(228, summary.Actual);
        Assert.Equal(215, summary.Good);
        Assert.Equal(13, summary.Nok);
        Assert.Equal(94.3, summary.YieldPercent);
        Assert.Equal(44, summary.DowntimeSeconds);
        Assert.Equal(2, summary.TickCount);
    }

    [Fact]
    public void AggregateByStation_isolates_stations()
    {
        var metrics = new[]
        {
            new MachineMetric { StationId = "A", ActualProductionCount = 50, GoodProductionCount = 40, RecordedAt = DateTimeOffset.UtcNow },
            new MachineMetric { StationId = "B", ActualProductionCount = 20, GoodProductionCount = 20, RecordedAt = DateTimeOffset.UtcNow }
        };

        var map = TelemetryAggregator.AggregateByStation(metrics);
        Assert.Equal(10, map["A"].Nok);
        Assert.Equal(0, map["B"].Nok);
        Assert.Equal(50, map["A"].Actual);
    }

    [Fact]
    public void FromTotals_scrap_is_actual_minus_good()
    {
        var summary = TelemetryAggregator.FromTotals("Montaj_Hatti_01", actual: 100, good: 93, downtimeSeconds: 0, tickCount: 1, lastRecordedAt: null);

        Assert.Equal(7, summary.Nok);
        Assert.Equal(93.0, summary.YieldPercent);
    }
}
