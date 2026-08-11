using MiniMesApi.Models;
using MiniMesApi.Services;

namespace MiniMesApi.Tests;

public class OeeSimulationTickTests
{
    [Fact]
    public void ShouldIngestProductionTick_WhenRunning_IsTrue()
    {
        Assert.True(OeeSimulationService.ShouldIngestProductionTick(isRunning: true));
    }

    [Fact]
    public void ShouldIngestProductionTick_WhenPausedOrDown_IsFalse()
    {
        Assert.False(OeeSimulationService.ShouldIngestProductionTick(isRunning: false));
    }

    [Fact]
    public void ShouldRunSimulationTicks_WhenDisabled_IsFalse()
    {
        Assert.False(OeeSimulationService.ShouldRunSimulationTicks(controlEnabled: false));
        Assert.True(OeeSimulationService.ShouldRunSimulationTicks(controlEnabled: true));
    }

    [Theory]
    [InlineData(StationRuntimeModes.Paused, true, true)]
    [InlineData(StationRuntimeModes.Down, true, true)]
    [InlineData(StationRuntimeModes.Running, true, false)]
    [InlineData(StationRuntimeModes.Paused, false, false)]
    [InlineData(StationRuntimeModes.Down, false, false)]
    public void ShouldWriteCatchUp_OnlyOnResumeFromPausedOrDown(
        string priorMode,
        bool isRunningNow,
        bool expected)
    {
        Assert.Equal(expected, OeeSimulationService.ShouldWriteCatchUp(priorMode, isRunningNow));
    }

    [Fact]
    public void BuildTick_WhenRunning_WritesIntervalAlignedProduction()
    {
        const int interval = 15;
        var recordedAt = DateTimeOffset.UtcNow;
        var profile = OeeSimulationService.ResolveStationProfile(StationCatalog.AssemblyLine1);
        var dto = OeeSimulationService.BuildTick(
            StationCatalog.AssemblyLine1,
            StationRuntimeModes.Running,
            isRunning: true,
            recordedAt,
            ShiftCatalog.ResolveForUtc(recordedAt),
            interval);

        Assert.Equal(interval, dto.PlannedProductionSeconds);
        Assert.Equal(profile.IdealCycleTimeSeconds, dto.IdealCycleTimeSeconds);
        Assert.InRange(dto.ActualProductionCount, 1, 12);
        Assert.InRange(dto.GoodProductionCount, 0, dto.ActualProductionCount);
        Assert.InRange(dto.DowntimeSeconds, 0, profile.MaxMicroDowntimeSeconds);
        Assert.True(dto.DowntimeSeconds <= dto.PlannedProductionSeconds);
        if (dto.DowntimeSeconds == 0)
            Assert.Equal(DowntimeReasonCatalog.None, dto.DowntimeReasonCode);
        Assert.True(dto.Temperature > 0);
        Assert.True(dto.Rpm >= 0);
    }

    [Fact]
    public void ResolveStationProfile_DifferentiatesActiveLines()
    {
        var montaj = OeeSimulationService.ResolveStationProfile(StationCatalog.AssemblyLine1);
        var test = OeeSimulationService.ResolveStationProfile(StationCatalog.TestAndQuality);
        var paket2 = OeeSimulationService.ResolveStationProfile(StationCatalog.PackagingLine2);

        Assert.True(test.IdealCycleTimeSeconds > montaj.IdealCycleTimeSeconds);
        Assert.True(test.ScrapProbability > montaj.ScrapProbability);
        Assert.True(paket2.MicroDowntimeProbability > montaj.MicroDowntimeProbability);
        Assert.True(paket2.PerformanceMax < montaj.PerformanceMax);
    }

    [Fact]
    public void BuildTick_WhenPaused_WritesFullIntervalDowntimeWithStableReason()
    {
        // Still used for resume catch-up construction — not for per-interval spam while paused.
        const int interval = 15;
        var recordedAt = DateTimeOffset.UtcNow;
        var dto = OeeSimulationService.BuildTick(
            StationCatalog.AssemblyLine1,
            StationRuntimeModes.Paused,
            isRunning: false,
            recordedAt,
            ShiftCatalog.ResolveForUtc(recordedAt),
            interval,
            pauseReason: "Operatör molası / duruş");

        Assert.Equal(interval, dto.PlannedProductionSeconds);
        Assert.Equal(0, dto.ActualProductionCount);
        Assert.Equal(0, dto.GoodProductionCount);
        Assert.Equal(interval, dto.DowntimeSeconds);
        Assert.Equal(DowntimeReasonCatalog.NoOperator, dto.DowntimeReasonCode);
        Assert.True(dto.Temperature < 45);
        Assert.True(dto.Rpm < 100);
    }

    [Fact]
    public void ResolveStableDowntimeReason_MapsPauseReasonWithoutRotating()
    {
        Assert.Equal(
            DowntimeReasonCatalog.Changeover,
            OeeSimulationService.ResolveStableDowntimeReason(
                StationRuntimeModes.Paused, "Setup / model değişimi"));
        Assert.Equal(
            DowntimeReasonCatalog.Breakdown,
            OeeSimulationService.ResolveStableDowntimeReason(
                StationRuntimeModes.Down, "Alarm: Yüksek sıcaklık"));
        Assert.Equal(
            DowntimeReasonCatalog.NoOperator,
            OeeSimulationService.ResolveStableDowntimeReason(
                StationRuntimeModes.Paused, "Operatör molası / duruş"));
        Assert.Equal(
            DowntimeReasonCatalog.Breakdown,
            OeeSimulationService.ResolveStableDowntimeReason(
                StationRuntimeModes.Down, pauseReason: null));
        Assert.Equal(
            DowntimeReasonCatalog.Other,
            OeeSimulationService.ResolveStableDowntimeReason(
                StationRuntimeModes.Paused, pauseReason: null));
    }

    [Fact]
    public void BuildCatchUp_WhenResuming_UsesElapsedPauseSecondsWithStableReason()
    {
        var pauseStarted = new DateTimeOffset(2026, 8, 5, 10, 0, 0, TimeSpan.Zero);
        var resumedAt = pauseStarted.AddSeconds(120);
        var dto = OeeSimulationService.BuildCatchUpDowntimeTick(
            StationCatalog.AssemblyLine1,
            StationRuntimeModes.Down,
            pauseStarted,
            resumedAt,
            ShiftCatalog.ShiftA,
            pauseReason: "Alarm: Arıza");

        Assert.NotNull(dto);
        Assert.Equal(120, dto!.PlannedProductionSeconds);
        Assert.Equal(120, dto.DowntimeSeconds);
        Assert.Equal(0, dto.ActualProductionCount);
        Assert.Equal(DowntimeReasonCatalog.Breakdown, dto.DowntimeReasonCode);
        Assert.Equal(ShiftCatalog.ShiftA, dto.ShiftCode);
    }

    [Fact]
    public void BuildCatchUp_ClampsToMaxAndReturnsNullWhenNegligible()
    {
        var pauseStarted = new DateTimeOffset(2026, 8, 5, 10, 0, 0, TimeSpan.Zero);

        var clamped = OeeSimulationService.ComputeCatchUpSeconds(
            pauseStarted,
            pauseStarted.AddHours(12),
            maxCatchUpSeconds: 3600);
        Assert.Equal(3600, clamped);

        Assert.Null(OeeSimulationService.BuildCatchUpDowntimeTick(
            StationCatalog.AssemblyLine1,
            StationRuntimeModes.Paused,
            pauseStarted,
            pauseStarted.AddMilliseconds(400),
            ShiftCatalog.ShiftA,
            pauseReason: "Mola"));

        Assert.Equal(0, OeeSimulationService.ComputeCatchUpSeconds(
            pauseStarted,
            pauseStarted.AddMilliseconds(400)));
    }

    [Fact]
    public void Transition_PausedStaysSkipped_RunningWrites_ResumeGetsCatchUp()
    {
        // While paused: no production ingest.
        Assert.False(OeeSimulationService.ShouldIngestProductionTick(isRunning: false));
        Assert.False(OeeSimulationService.ShouldWriteCatchUp(StationRuntimeModes.Paused, isRunningNow: false));

        // Still running: production ingest, no catch-up.
        Assert.True(OeeSimulationService.ShouldIngestProductionTick(isRunning: true));
        Assert.False(OeeSimulationService.ShouldWriteCatchUp(StationRuntimeModes.Running, isRunningNow: true));

        // Resume from Down: catch-up + production.
        Assert.True(OeeSimulationService.ShouldIngestProductionTick(isRunning: true));
        Assert.True(OeeSimulationService.ShouldWriteCatchUp(StationRuntimeModes.Down, isRunningNow: true));
    }

    [Fact]
    public void ExtremeGaugeProbabilities_AreSparseForDemoSessions()
    {
        // ~20% lower raise chance vs prior demo rates (0.004 / 0.002 / 0.004).
        Assert.Equal(0.0032, OeeSimulationService.ExtremeTemperatureProbability);
        Assert.Equal(0.0016, OeeSimulationService.ExtremeRpmProbability);
        Assert.Equal(0.0032, OeeSimulationService.ExtremeVibrationProbability);
    }

    [Fact]
    public void ScrapProbability_DefaultFallback_IsRaisedForDemoFireRate()
    {
        // Bilinmeyen istasyon fallback'i; aktif hatlar StationSimProfile kullanır.
        Assert.Equal(0.046, OeeSimulationService.ScrapProbability);
    }

    [Fact]
    public void GeneratePhysicalGauges_Idle_AreLow()
    {
        var (temp, rpm, vib) = OeeSimulationService.GeneratePhysicalGauges(isRunning: false);
        Assert.InRange(temp, 28, 40);
        Assert.InRange(rpm, 0, 80);
        Assert.InRange(vib, 0.05, 0.30);
    }

    [Fact]
    public void OeeCalculator_WorksWithIntervalSizedWindows()
    {
        var metric = new MachineMetric
        {
            StationId = StationCatalog.AssemblyLine1,
            PlannedProductionSeconds = 15,
            DowntimeSeconds = 0,
            IdealCycleTimeSeconds = 2,
            ActualProductionCount = 7,
            GoodProductionCount = 7,
            RecordedAt = DateTimeOffset.UtcNow
        };

        var oee = OeeCalculator.Calculate(metric);
        Assert.Equal(15, oee.PlannedProductionSeconds);
        Assert.Equal(15, oee.OperatingTimeSeconds);
        Assert.InRange(oee.Availability, 99, 100);
        Assert.InRange(oee.Performance, 90, 100);
        Assert.Equal(100, oee.Quality);
        Assert.True(oee.Oee > 0);
    }
}
