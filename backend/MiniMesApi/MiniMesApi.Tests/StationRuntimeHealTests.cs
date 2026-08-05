using Microsoft.EntityFrameworkCore;
using MiniMesApi.Models;
using MiniMesApi.Services;

namespace MiniMesApi.Tests;

public class StationRuntimeHealTests
{
    private static MesDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<MesDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new MesDbContext(options);
    }

    [Fact]
    public async Task Heal_ActiveShift_NoAlarms_ForcesRunning()
    {
        await using var db = CreateContext();
        db.StationRuntimes.Add(new StationRuntime
        {
            StationId = StationCatalog.AssemblyLine1,
            Mode = StationRuntimeModes.Paused,
            PauseReason = "Stale pause",
            UpdatedAt = DateTimeOffset.UtcNow
        });
        db.ShiftSessions.Add(new ShiftSession
        {
            UserId = "op1",
            StationId = StationCatalog.AssemblyLine1,
            ShiftCode = ShiftCatalog.ShiftA,
            OperatorName = "Test",
            StartedAt = DateTimeOffset.UtcNow,
            Status = ShiftSessionStatuses.Active
        });
        await db.SaveChangesAsync();

        var service = new StationRuntimeService(db);
        var mode = await service.HealRuntimeForStationAsync(StationCatalog.AssemblyLine1);

        Assert.Equal(StationRuntimeModes.Running, mode);
        var runtime = await db.StationRuntimes.FindAsync(StationCatalog.AssemblyLine1);
        Assert.Equal(StationRuntimeModes.Running, runtime!.Mode);
        Assert.Null(runtime.PauseReason);
    }

    [Fact]
    public async Task Heal_OnBreak_KeepsPaused()
    {
        await using var db = CreateContext();
        db.StationRuntimes.Add(new StationRuntime
        {
            StationId = StationCatalog.AssemblyLine1,
            Mode = StationRuntimeModes.Paused,
            PauseReason = "Mola",
            UpdatedAt = DateTimeOffset.UtcNow
        });
        db.ShiftSessions.Add(new ShiftSession
        {
            UserId = "op1",
            StationId = StationCatalog.AssemblyLine1,
            ShiftCode = ShiftCatalog.ShiftA,
            OperatorName = "Test",
            StartedAt = DateTimeOffset.UtcNow,
            Status = ShiftSessionStatuses.OnBreak,
            BreakReason = "NO_OPERATOR"
        });
        await db.SaveChangesAsync();

        var service = new StationRuntimeService(db);
        var mode = await service.HealRuntimeForStationAsync(StationCatalog.AssemblyLine1);

        Assert.Equal(StationRuntimeModes.Paused, mode);
    }

    [Fact]
    public async Task Heal_OpenBlockingAlarm_DoesNotResume()
    {
        await using var db = CreateContext();
        db.StationRuntimes.Add(new StationRuntime
        {
            StationId = StationCatalog.AssemblyLine1,
            Mode = StationRuntimeModes.Paused,
            PauseReason = "Alarm",
            UpdatedAt = DateTimeOffset.UtcNow
        });
        db.ShiftSessions.Add(new ShiftSession
        {
            UserId = "op1",
            StationId = StationCatalog.AssemblyLine1,
            ShiftCode = ShiftCatalog.ShiftA,
            OperatorName = "Test",
            StartedAt = DateTimeOffset.UtcNow,
            Status = ShiftSessionStatuses.Active
        });
        db.Alarms.Add(new Alarm
        {
            Title = "Yüksek Sıcaklık",
            Station = StationCatalog.AssemblyLine1,
            Severity = "Yüksek",
            Status = "Açık",
            Time = DateTimeOffset.UtcNow,
            Description = "test"
        });
        await db.SaveChangesAsync();

        var service = new StationRuntimeService(db);
        var mode = await service.HealRuntimeForStationAsync(StationCatalog.AssemblyLine1);

        Assert.Equal(StationRuntimeModes.Paused, mode);
    }

    [Fact]
    public async Task ClearOperatorHoldAlarms_ThenResume_Succeeds()
    {
        await using var db = CreateContext();
        db.StationRuntimes.Add(new StationRuntime
        {
            StationId = StationCatalog.AssemblyLine1,
            Mode = StationRuntimeModes.Paused,
            PauseReason = "Duruş",
            UpdatedAt = DateTimeOffset.UtcNow
        });
        db.Alarms.Add(new Alarm
        {
            Title = "Duruş Bildirimi — Mola",
            Station = StationCatalog.AssemblyLine1,
            Severity = "Uyarı",
            Status = "Açık",
            Time = DateTimeOffset.UtcNow,
            Description = "op hold"
        });
        await db.SaveChangesAsync();

        var service = new StationRuntimeService(db);
        Assert.True(await service.HasOpenBlockingAlarmAsync(StationCatalog.AssemblyLine1));

        var cleared = await service.ClearOperatorHoldAlarmsAsync(StationCatalog.AssemblyLine1, "op1");
        Assert.Equal(1, cleared);
        Assert.False(await service.HasOpenBlockingAlarmAsync(StationCatalog.AssemblyLine1));

        Assert.True(await service.TryResumeAsync(StationCatalog.AssemblyLine1));
    }

    [Fact]
    public void IsOperatorHoldAlarm_MatchesDowntimeAndSetup()
    {
        Assert.True(StationRuntimeService.IsOperatorHoldAlarm("Duruş Bildirimi — Mola"));
        Assert.True(StationRuntimeService.IsOperatorHoldAlarm("Model Değişimi / Setup"));
        Assert.True(StationRuntimeService.IsOperatorHoldAlarm("ARIZA / ACİL — Breakdown"));
        Assert.False(StationRuntimeService.IsOperatorHoldAlarm("Yüksek Sıcaklık"));
    }
}
