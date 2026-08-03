using MiniMesApi.DTOs;
using MiniMesApi.Models;

namespace MiniMesApi.Services;

public static class OeeCalculator
{
    public static OeeMetricDto Calculate(MachineMetric metric)
    {
        var operatingTime = Math.Max(
            metric.PlannedProductionSeconds - metric.DowntimeSeconds,
            0);
        var availability = metric.PlannedProductionSeconds > 0
            ? operatingTime / metric.PlannedProductionSeconds * 100
            : 0;
        var performance = operatingTime > 0
            ? metric.IdealCycleTimeSeconds * metric.ActualProductionCount / operatingTime * 100
            : 0;
        var quality = metric.ActualProductionCount > 0
            ? (double)metric.GoodProductionCount / metric.ActualProductionCount * 100
            : 0;

        availability = Math.Clamp(availability, 0, 100);
        performance = Math.Clamp(performance, 0, 100);
        quality = Math.Clamp(quality, 0, 100);

        return new OeeMetricDto
        {
            StationId = metric.StationId,
            Availability = Math.Round(availability, 1),
            Performance = Math.Round(performance, 1),
            Quality = Math.Round(quality, 1),
            Oee = Math.Round(availability * performance * quality / 10000, 1),
            PlannedProductionSeconds = metric.PlannedProductionSeconds,
            OperatingTimeSeconds = operatingTime,
            DowntimeSeconds = metric.DowntimeSeconds,
            TotalProduction = metric.ActualProductionCount,
            GoodProduction = metric.GoodProductionCount,
            ScrapProduction = Math.Max(
                metric.ActualProductionCount - metric.GoodProductionCount,
                0),
            LastUpdated = metric.RecordedAt
        };
    }
}
