namespace MiniMesApi.Services;

public static class MachineMetricInvariants
{
    public static void Normalize(Models.MachineMetric metric)
    {
        metric.PlannedProductionSeconds = Math.Max(metric.PlannedProductionSeconds, 0.001);
        metric.DowntimeSeconds = Math.Clamp(
            metric.DowntimeSeconds,
            0,
            metric.PlannedProductionSeconds);
        metric.IdealCycleTimeSeconds = Math.Max(metric.IdealCycleTimeSeconds, 0.001);
        metric.ActualProductionCount = Math.Max(metric.ActualProductionCount, 0);
        metric.GoodProductionCount = Math.Clamp(
            metric.GoodProductionCount,
            0,
            metric.ActualProductionCount);

        if (metric.DowntimeSeconds <= 0)
        {
            metric.DowntimeReasonCode = Models.DowntimeReasonCatalog.None;
        }
        else if (string.IsNullOrWhiteSpace(metric.DowntimeReasonCode) ||
                 string.Equals(metric.DowntimeReasonCode, Models.DowntimeReasonCatalog.None, StringComparison.Ordinal))
        {
            metric.DowntimeReasonCode = Models.DowntimeReasonCatalog.Other;
        }

        if (string.IsNullOrWhiteSpace(metric.ShiftCode))
        {
            metric.ShiftCode = Models.ShiftCatalog.ResolveForUtc(metric.RecordedAt);
        }
    }
}
