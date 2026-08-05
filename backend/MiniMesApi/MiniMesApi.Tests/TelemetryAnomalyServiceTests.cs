using Microsoft.EntityFrameworkCore;
using MiniMesApi.DTOs;
using MiniMesApi.Models;
using MiniMesApi.Services;

namespace MiniMesApi.Tests;

public class TelemetryAnomalyServiceTests
{
    [Fact]
    public void CooldownBounds_AreSparseForDemoSessions()
    {
        Assert.Equal(TimeSpan.FromMinutes(15), TelemetryAnomalyService.MinCooldown);
        Assert.Equal(TimeSpan.FromMinutes(45), TelemetryAnomalyService.MaxCooldown);
    }

    [Fact]
    public void NextCooldown_IsWithinConfiguredRange()
    {
        for (var i = 0; i < 80; i++)
        {
            var cooldown = TelemetryAnomalyService.NextCooldown();
            Assert.InRange(
                cooldown.TotalSeconds,
                TelemetryAnomalyService.MinCooldown.TotalSeconds,
                TelemetryAnomalyService.MaxCooldown.TotalSeconds);
        }
    }

    [Fact]
    public void Detect_HighVibration_ReturnsCritical()
    {
        var metric = new MachineMetric
        {
            StationId = StationCatalog.AssemblyLine1,
            PlannedProductionSeconds = 300,
            DowntimeSeconds = 0,
            IdealCycleTimeSeconds = 2,
            ActualProductionCount = 120,
            GoodProductionCount = 118,
            Vibration = 3.1,
            Temperature = 60,
            Rpm = 1200,
            RecordedAt = DateTimeOffset.UtcNow
        };

        var anomaly = TelemetryAnomalyService.Detect(metric);
        Assert.NotNull(anomaly);
        Assert.Equal("Kritik", anomaly!.Severity);
        Assert.Contains("Titreşim", anomaly.Title, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Detect_IdleTick_DoesNotFlagLowRpm()
    {
        var metric = new MachineMetric
        {
            StationId = StationCatalog.AssemblyLine1,
            PlannedProductionSeconds = 300,
            DowntimeSeconds = 240,
            IdealCycleTimeSeconds = 2,
            ActualProductionCount = 0,
            GoodProductionCount = 0,
            Vibration = 0.1,
            Temperature = 35,
            Rpm = 20,
            RecordedAt = DateTimeOffset.UtcNow
        };

        Assert.Null(TelemetryAnomalyService.Detect(metric));
    }

    [Fact]
    public async Task EvaluateAndRaise_PersistsCooldownOnStationRuntime()
    {
        await using var db = new MesDbContext(new DbContextOptionsBuilder<MesDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

        db.StationRuntimes.Add(new StationRuntime
        {
            StationId = StationCatalog.AssemblyLine1,
            Mode = StationRuntimeModes.Running,
            UpdatedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();

        var runtimeService = new StationRuntimeService(db);
        var service = new TelemetryAnomalyService(db, new NoopRealtimePublisher(), runtimeService);

        var metric = new MachineMetric
        {
            StationId = StationCatalog.AssemblyLine1,
            PlannedProductionSeconds = 300,
            DowntimeSeconds = 0,
            IdealCycleTimeSeconds = 2,
            ActualProductionCount = 120,
            GoodProductionCount = 118,
            Vibration = 3.1,
            Temperature = 60,
            Rpm = 1200,
            RecordedAt = DateTimeOffset.UtcNow
        };

        await service.EvaluateAndRaiseAsync(metric);
        var runtime = await db.StationRuntimes.FindAsync(StationCatalog.AssemblyLine1);
        Assert.NotNull(runtime!.NextAnomalyAllowedAt);
        Assert.True(runtime.NextAnomalyAllowedAt > DateTimeOffset.UtcNow);
        Assert.Equal(1, await db.Alarms.CountAsync());

        // Second raise while cooldown active must not spam.
        await service.EvaluateAndRaiseAsync(metric);
        Assert.Equal(1, await db.Alarms.CountAsync());
    }

    [Fact]
    public async Task EvaluateAndRaise_SkipsLegacyRetiredStation()
    {
        await using var db = new MesDbContext(new DbContextOptionsBuilder<MesDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

        var runtimeService = new StationRuntimeService(db);
        var service = new TelemetryAnomalyService(db, new NoopRealtimePublisher(), runtimeService);

        var metric = new MachineMetric
        {
            StationId = StationCatalog.TestAndPackaging,
            PlannedProductionSeconds = 300,
            DowntimeSeconds = 0,
            IdealCycleTimeSeconds = 2,
            ActualProductionCount = 120,
            GoodProductionCount = 118,
            Vibration = 3.1,
            Temperature = 60,
            Rpm = 1200,
            RecordedAt = DateTimeOffset.UtcNow
        };

        await service.EvaluateAndRaiseAsync(metric);
        Assert.Equal(0, await db.Alarms.CountAsync());
        Assert.False(StationCatalog.IsActive(StationCatalog.TestAndPackaging));
        Assert.True(StationCatalog.Contains(StationCatalog.TestAndPackaging));
    }

    [Fact]
    public void StationCatalog_Active_ExcludesLegacyAndMatchesShopFloor()
    {
        Assert.DoesNotContain(StationCatalog.TestAndPackaging, StationCatalog.Active);
        Assert.Contains(StationCatalog.AssemblyLine1, StationCatalog.Active);
        Assert.Contains(StationCatalog.TestAndQuality, StationCatalog.Active);
        Assert.Equal(6, StationCatalog.Active.Count);
        Assert.True(StationCatalog.IsActive(StationCatalog.FinalInspection));
        Assert.False(StationCatalog.IsActive("Montaj_Hatti_02"));
        Assert.False(StationCatalog.IsActive("Montaj_Hatti_03"));
    }

    private sealed class NoopRealtimePublisher : IMesRealtimePublisher
    {
        public Task AlarmCreatedAsync(AlarmDto alarm, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task AlarmUpdatedAsync(AlarmDto alarm, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task AlarmDeletedAsync(int alarmId, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task OeeUpdatedAsync(IReadOnlyCollection<OeeMetricDto> metrics, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task TelemetryTickAsync(MachineMetricDto metric, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task ShiftUpdatedAsync(ShiftSessionDto session, CancellationToken cancellationToken = default) => Task.CompletedTask;
    }
}
