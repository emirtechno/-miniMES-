using MiniMesApi.DTOs;
using MiniMesApi.Models;

namespace MiniMesApi.Services;

// NEDEN: OEE (Overall Equipment Effectiveness) tek formülle hesaplanır: A × P × Q.
// Hem tek tick (Andon anlık) hem pencere toplamı (vardiya oturumu) aynı çekirdeği kullanır — tutarlı panolar.
// NASIL: Availability = (planned−downtime)/planned; Performance = (ICT×actual)/operatingTime; Quality = good/actual; OEE = A×P×Q/10000.
public static class OeeCalculator
{
    public static OeeMetricDto Calculate(MachineMetric metric)
    {
        ArgumentNullException.ThrowIfNull(metric);

        var shiftCode = string.IsNullOrWhiteSpace(metric.ShiftCode)
            ? ShiftCatalog.ResolveForUtc(metric.RecordedAt)
            : metric.ShiftCode;

        return CalculateCore(
            stationId: metric.StationId,
            planned: Math.Max(metric.PlannedProductionSeconds, 0),
            downtime: Math.Max(metric.DowntimeSeconds, 0),
            idealCycleTimeSeconds: metric.IdealCycleTimeSeconds,
            actual: Math.Max(metric.ActualProductionCount, 0),
            good: Math.Clamp(metric.GoodProductionCount, 0, Math.Max(metric.ActualProductionCount, 0)),
            downtimeReasonCode: metric.DowntimeReasonCode,
            shiftCode: shiftCode,
            lastUpdated: metric.RecordedAt);
    }

    // NEDEN: Vardiya oturumu / Andon board birden fazla MachineMetric satırını tek OEE'ye indirger.
    // Durum/duruş nedeni statusMetric'ten (genelde en son tick) alınır; sayılar penceredeki tüm satırlardan toplanır.
    // NASIL: planned/downtime/actual/good toplanır; ICT üretim ağırlıklı ortalamayla; CalculateCore'a verilir.
    public static OeeMetricDto CalculateFromWindow(
        IReadOnlyList<MachineMetric> metrics,
        string stationId,
        string shiftCode,
        MachineMetric? statusMetric = null)
    {
        ArgumentNullException.ThrowIfNull(metrics);

        if (string.IsNullOrWhiteSpace(shiftCode))
        {
            shiftCode = statusMetric is not null
                ? (string.IsNullOrWhiteSpace(statusMetric.ShiftCode)
                    ? ShiftCatalog.ResolveForUtc(statusMetric.RecordedAt)
                    : statusMetric.ShiftCode)
                : ShiftCatalog.ResolveForUtc(DateTimeOffset.UtcNow);
        }

        if (metrics.Count == 0)
        {
            var emptyStatus = statusMetric;
            return CalculateCore(
                stationId: stationId,
                planned: 0,
                downtime: 0,
                idealCycleTimeSeconds: emptyStatus?.IdealCycleTimeSeconds ?? 0,
                actual: 0,
                good: 0,
                downtimeReasonCode: emptyStatus?.DowntimeReasonCode ?? DowntimeReasonCatalog.None,
                shiftCode: shiftCode,
                lastUpdated: emptyStatus?.RecordedAt ?? default);
        }

        double planned = 0;
        double downtime = 0;
        long actual = 0;
        long good = 0;
        double ictWeighted = 0;
        long ictWeight = 0;
        double ictSum = 0;
        DateTimeOffset lastUpdated = metrics[0].RecordedAt;
        MachineMetric? latestInWindow = null;

        foreach (var metric in metrics)
        {
            var rowActual = Math.Max(metric.ActualProductionCount, 0);
            var rowGood = Math.Clamp(metric.GoodProductionCount, 0, rowActual);
            planned += Math.Max(metric.PlannedProductionSeconds, 0);
            downtime += Math.Max(metric.DowntimeSeconds, 0);
            actual += rowActual;
            good += rowGood;
            ictSum += metric.IdealCycleTimeSeconds;
            // NEDEN: Ideal cycle time üretim yapan tick'lerde daha anlamlı; ağırlıklı ortalama kullanılır.
            if (rowActual > 0)
            {
                ictWeighted += metric.IdealCycleTimeSeconds * rowActual;
                ictWeight += rowActual;
            }

            if (latestInWindow is null || metric.RecordedAt > latestInWindow.RecordedAt
                || (metric.RecordedAt == latestInWindow.RecordedAt && metric.Id > latestInWindow.Id))
            {
                latestInWindow = metric;
            }

            if (metric.RecordedAt > lastUpdated)
            {
                lastUpdated = metric.RecordedAt;
            }
        }

        var status = statusMetric ?? latestInWindow!;
        var idealCycle = ictWeight > 0
            ? ictWeighted / ictWeight
            : ictSum / metrics.Count;

        var actualInt = actual > int.MaxValue ? int.MaxValue : (int)actual;
        var goodInt = good > int.MaxValue ? int.MaxValue : (int)good;

        return CalculateCore(
            stationId: stationId,
            planned: planned,
            downtime: downtime,
            idealCycleTimeSeconds: idealCycle,
            actual: actualInt,
            good: goodInt,
            downtimeReasonCode: status.DowntimeReasonCode,
            shiftCode: shiftCode,
            lastUpdated: statusMetric?.RecordedAt > lastUpdated
                ? statusMetric.RecordedAt
                : lastUpdated);
    }

    // NEDEN: A/P/Q formülü tek yerde — tek tick ve pencere toplamı aynı kuralları paylaşır.
    // NASIL: downtime planned'ı aşamaz; good ≤ actual; sonuçlar 0–100'e clamp; OEE = A×P×Q/10000.
    private static OeeMetricDto CalculateCore(
        string stationId,
        double planned,
        double downtime,
        double idealCycleTimeSeconds,
        int actual,
        int good,
        string? downtimeReasonCode,
        string shiftCode,
        DateTimeOffset lastUpdated)
    {
        downtime = Math.Clamp(downtime, 0, planned > 0 ? planned : downtime);
        good = Math.Clamp(good, 0, actual);
        var reasonCode = string.IsNullOrWhiteSpace(downtimeReasonCode)
            ? (downtime > 0 ? DowntimeReasonCatalog.Other : DowntimeReasonCatalog.None)
            : downtimeReasonCode;

        var operatingTime = Math.Max(planned - downtime, 0);
        var availability = planned > 0
            ? operatingTime / planned * 100
            : 0;
        var performance = operatingTime > 0
            ? idealCycleTimeSeconds * actual / operatingTime * 100
            : 0;
        var quality = actual > 0
            ? (double)good / actual * 100
            : 0;

        availability = Math.Clamp(availability, 0, 100);
        performance = Math.Clamp(performance, 0, 100);
        quality = Math.Clamp(quality, 0, 100);

        return new OeeMetricDto
        {
            StationId = stationId,
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
            LastUpdated = lastUpdated
        };
    }
}
