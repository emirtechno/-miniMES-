using MiniMesApi.DTOs;
using MiniMesApi.Models;

namespace MiniMesApi.Services;

/// <summary>Aggregate MachineMetric rows into plant / station KPIs.</summary>
public static class TelemetryAggregator
{
    public static TelemetrySummaryDto Aggregate(IEnumerable<MachineMetric> metrics, string? stationId = null)
    {
        var list = metrics as IList<MachineMetric> ?? metrics.ToList();
        if (list.Count == 0)
        {
            return new TelemetrySummaryDto
            {
                StationId = stationId,
                Actual = 0,
                Good = 0,
                Nok = 0,
                YieldPercent = 0,
                DowntimeSeconds = 0,
                TickCount = 0,
                LastRecordedAt = null
            };
        }

        long actual = 0;
        long good = 0;
        double downtime = 0;
        DateTimeOffset? last = null;
        foreach (var metric in list)
        {
            actual += Math.Max(metric.ActualProductionCount, 0);
            good += Math.Clamp(metric.GoodProductionCount, 0, Math.Max(metric.ActualProductionCount, 0));
            downtime += Math.Max(metric.DowntimeSeconds, 0);
            if (last is null || metric.RecordedAt > last)
            {
                last = metric.RecordedAt;
            }
        }

        var actualInt = actual > int.MaxValue ? int.MaxValue : (int)actual;
        var goodInt = good > int.MaxValue ? int.MaxValue : (int)good;
        var nok = Math.Max(actualInt - goodInt, 0);
        var yield = actualInt > 0 ? Math.Round((double)goodInt / actualInt * 100, 1) : 0;

        return new TelemetrySummaryDto
        {
            StationId = stationId,
            Actual = actualInt,
            Good = goodInt,
            Nok = nok,
            YieldPercent = yield,
            DowntimeSeconds = Math.Round(downtime, 1),
            TickCount = list.Count,
            LastRecordedAt = last
        };
    }

    public static IReadOnlyDictionary<string, TelemetrySummaryDto> AggregateByStation(
        IEnumerable<MachineMetric> metrics)
    {
        return metrics
            .GroupBy(metric => metric.StationId, StringComparer.Ordinal)
            .ToDictionary(
                group => group.Key,
                group => Aggregate(group, group.Key),
                StringComparer.Ordinal);
    }
}
