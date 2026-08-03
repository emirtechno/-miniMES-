using MiniMesApi.Models;
using MiniMesApi.Services;

namespace MiniMesApi.Tests;

public sealed class OeeCalculatorTests
{
    [Fact]
    public void Calculate_clamps_ratios_and_derives_oee()
    {
        var metric = new MachineMetric
        {
            StationId = "Montaj_Hatti_01",
            PlannedProductionSeconds = 100,
            DowntimeSeconds = 20,
            IdealCycleTimeSeconds = 1,
            ActualProductionCount = 70,
            GoodProductionCount = 63,
            RecordedAt = DateTime.UtcNow
        };

        var result = OeeCalculator.Calculate(metric);

        Assert.Equal(80, result.Availability);
        Assert.Equal(87.5, result.Performance);
        Assert.Equal(90, result.Quality);
        Assert.Equal(63, result.Oee);
        Assert.Equal(7, result.ScrapProduction);
    }

    [Fact]
    public void Calculate_handles_zero_planned_time()
    {
        var result = OeeCalculator.Calculate(new MachineMetric
        {
            StationId = "Montaj_Hatti_01",
            PlannedProductionSeconds = 0,
            DowntimeSeconds = 0,
            IdealCycleTimeSeconds = 1,
            ActualProductionCount = 0,
            GoodProductionCount = 0
        });

        Assert.Equal(0, result.Availability);
        Assert.Equal(0, result.Performance);
        Assert.Equal(0, result.Quality);
        Assert.Equal(0, result.Oee);
    }
}
