using MiniMesApi.Models;
using MiniMesApi.Services;

namespace MiniMesApi.Tests;

public sealed class OeeShiftAggregateTests
{
    [Fact]
    public void ResolveWindowForUtc_maps_shift_a_daytime()
    {
        var at = new DateTimeOffset(2026, 8, 5, 10, 30, 0, TimeSpan.Zero);
        var window = ShiftCatalog.ResolveWindowForUtc(at);

        Assert.Equal(ShiftCatalog.ShiftA, window.Code);
        Assert.Equal(new DateTimeOffset(2026, 8, 5, 6, 0, 0, TimeSpan.Zero), window.Start);
        Assert.Equal(new DateTimeOffset(2026, 8, 5, 14, 0, 0, TimeSpan.Zero), window.End);
    }

    [Fact]
    public void ResolveWindowForUtc_maps_overnight_shift_c()
    {
        var at = new DateTimeOffset(2026, 8, 5, 2, 0, 0, TimeSpan.Zero);
        var window = ShiftCatalog.ResolveWindowForUtc(at);

        Assert.Equal(ShiftCatalog.ShiftC, window.Code);
        Assert.Equal(new DateTimeOffset(2026, 8, 4, 22, 0, 0, TimeSpan.Zero), window.Start);
        Assert.Equal(new DateTimeOffset(2026, 8, 5, 6, 0, 0, TimeSpan.Zero), window.End);
    }

    [Fact]
    public void CalculateFromWindow_sums_counts_and_computes_oee()
    {
        var metrics = new[]
        {
            new MachineMetric
            {
                Id = 1,
                StationId = "Montaj_Hatti_01",
                PlannedProductionSeconds = 100,
                DowntimeSeconds = 10,
                IdealCycleTimeSeconds = 1,
                ActualProductionCount = 50,
                GoodProductionCount = 45,
                DowntimeReasonCode = DowntimeReasonCatalog.None,
                ShiftCode = ShiftCatalog.ShiftA,
                RecordedAt = new DateTimeOffset(2026, 8, 5, 7, 0, 0, TimeSpan.Zero)
            },
            new MachineMetric
            {
                Id = 2,
                StationId = "Montaj_Hatti_01",
                PlannedProductionSeconds = 100,
                DowntimeSeconds = 10,
                IdealCycleTimeSeconds = 1,
                ActualProductionCount = 40,
                GoodProductionCount = 36,
                DowntimeReasonCode = DowntimeReasonCatalog.None,
                ShiftCode = ShiftCatalog.ShiftA,
                RecordedAt = new DateTimeOffset(2026, 8, 5, 7, 15, 0, TimeSpan.Zero)
            }
        };

        // Latest tick paused — status overlay should use BREAKDOWN while totals stay shift-summed.
        var latest = new MachineMetric
        {
            Id = 3,
            StationId = "Montaj_Hatti_01",
            PlannedProductionSeconds = 100,
            DowntimeSeconds = 100,
            IdealCycleTimeSeconds = 1,
            ActualProductionCount = 0,
            GoodProductionCount = 0,
            DowntimeReasonCode = DowntimeReasonCatalog.Breakdown,
            ShiftCode = ShiftCatalog.ShiftA,
            RecordedAt = new DateTimeOffset(2026, 8, 5, 7, 30, 0, TimeSpan.Zero)
        };

        var result = OeeCalculator.CalculateFromWindow(
            metrics,
            "Montaj_Hatti_01",
            ShiftCatalog.ShiftA,
            latest);

        Assert.Equal(81, result.GoodProduction);
        Assert.Equal(9, result.ScrapProduction);
        Assert.Equal(90, result.TotalProduction);
        Assert.Equal(200, result.PlannedProductionSeconds);
        Assert.Equal(20, result.DowntimeSeconds);
        Assert.Equal(90, result.Availability); // (200-20)/200
        Assert.Equal(50, result.Performance); // 1*90/180
        Assert.Equal(90, result.Quality); // 81/90
        Assert.Equal(40.5, result.Oee);
        Assert.Equal(DowntimeReasonCatalog.Breakdown, result.DowntimeReasonCode);
        Assert.Equal(ShiftCatalog.ShiftA, result.ShiftCode);
        Assert.Equal("Vardiya A (06–14)", result.ShiftName);
    }

    [Fact]
    public void CalculateFromWindow_empty_uses_status_downtime_and_zeros()
    {
        var latest = new MachineMetric
        {
            Id = 9,
            StationId = "Montaj_Hatti_01",
            DowntimeReasonCode = DowntimeReasonCatalog.MaterialShortage,
            DowntimeSeconds = 30,
            ShiftCode = ShiftCatalog.ShiftB,
            RecordedAt = DateTimeOffset.UtcNow
        };

        var result = OeeCalculator.CalculateFromWindow(
            Array.Empty<MachineMetric>(),
            "Montaj_Hatti_01",
            ShiftCatalog.ShiftB,
            latest);

        Assert.Equal(0, result.GoodProduction);
        Assert.Equal(0, result.Oee);
        Assert.Equal(DowntimeReasonCatalog.MaterialShortage, result.DowntimeReasonCode);
        Assert.Equal(ShiftCatalog.ShiftB, result.ShiftCode);
    }
}
