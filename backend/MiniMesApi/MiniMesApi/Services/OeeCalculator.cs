using MiniMesApi.DTOs;
using MiniMesApi.Models;

namespace MiniMesApi.Services;

public static class OeeCalculator
{
    public static OeeMetricDto Calculate(MachineMetric metric)
    {
        var planned = Math.Max(metric.PlannedProductionSeconds, 0);
        var downtime = Math.Clamp(metric.DowntimeSeconds, 0, planned > 0 ? planned : metric.DowntimeSeconds);
        var actual = Math.Max(metric.ActualProductionCount, 0);
        var good = Math.Clamp(metric.GoodProductionCount, 0, actual);
        var reasonCode = string.IsNullOrWhiteSpace(metric.DowntimeReasonCode)
            ? (downtime > 0 ? DowntimeReasonCatalog.Other : DowntimeReasonCatalog.None)
            : metric.DowntimeReasonCode;
        var shiftCode = string.IsNullOrWhiteSpace(metric.ShiftCode)
            ? ShiftCatalog.ResolveForUtc(metric.RecordedAt)
            : metric.ShiftCode;

        var operatingTime = Math.Max(planned - downtime, 0);
        var availability = planned > 0
            ? operatingTime / planned * 100
            : 0;
        var performance = operatingTime > 0
            ? metric.IdealCycleTimeSeconds * actual / operatingTime * 100
            : 0;
        var quality = actual > 0
            ? (double)good / actual * 100
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
            PlannedProductionSeconds = planned,
            OperatingTimeSeconds = operatingTime,
            DowntimeSeconds = downtime,
            DowntimeReasonCode = reasonCode,
            DowntimeReason = DowntimeReasonCatalog.DisplayName(reasonCode),
            IsPlannedDowntime = DowntimeReasonCatalog.IsPlanned(reasonCode),
            ShiftCode = shiftCode,
            ShiftName = ShiftCatalog.DisplayName(shiftCode),
            TotalProduction = actual,
            GoodProduction = good,
            ScrapProduction = Math.Max(actual - good, 0),
            LastUpdated = metric.RecordedAt
        };
    }
}
