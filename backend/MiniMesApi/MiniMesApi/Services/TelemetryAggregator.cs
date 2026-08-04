using MiniMesApi.DTOs;
using MiniMesApi.Models;

namespace MiniMesApi.Services;

/// <summary>Aggregate MachineMetric rows into plant / station KPIs.</summary>
public static class TelemetryAggregator
{
    /// <summary>Build KPI DTO from pre-aggregated SQL totals (preferred hot path).</summary>
    public static TelemetrySummaryDto FromTotals(
        string? stationId,
        long actual,
        long good,
        double downtimeSeconds,
        int tickCount,
        DateTimeOffset? lastRecordedAt)
    {
        var actualInt = actual > int.MaxValue ? int.MaxValue : (int)Math.Max(actual, 0);
        var goodClamped = Math.Clamp(good, 0, actual);
        var goodInt = goodClamped > int.MaxValue ? int.MaxValue : (int)goodClamped;
        var nok = Math.Max(actualInt - goodInt, 0);
        var yield = actualInt > 0 ? Math.Round((double)goodInt / actualInt * 100, 1) : 0;

        return new TelemetrySummaryDto
        {
            StationId = stationId,
            Actual = actualInt,
            Good = goodInt,
            Nok = nok,
            YieldPercent = yield,
            DowntimeSeconds = Math.Round(Math.Max(downtimeSeconds, 0), 1),
            TickCount = Math.Max(tickCount, 0),
            LastRecordedAt = lastRecordedAt
        };
    }

    public static TelemetrySummaryDto Aggregate(IEnumerable<MachineMetric> metrics, string? stationId = null)
    {
        var list = metrics as IList<MachineMetric> ?? metrics.ToList();
        if (list.Count == 0)
        {
            return FromTotals(stationId, 0, 0, 0, 0, null);
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

        return FromTotals(stationId, actual, good, downtime, list.Count, last);
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
