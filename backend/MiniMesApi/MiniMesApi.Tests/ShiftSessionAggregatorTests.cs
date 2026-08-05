using Microsoft.EntityFrameworkCore;
using MiniMesApi.Models;
using MiniMesApi.Services;

namespace MiniMesApi.Tests;

public sealed class ShiftSessionAggregatorTests
{
    private static MesDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<MesDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new MesDbContext(options);
    }

    [Fact]
    public async Task BuildAsync_prefers_ShiftSessionId_over_time_window()
    {
        await using var db = CreateContext();
        var started = DateTimeOffset.UtcNow.AddHours(-1);
        var session = new ShiftSession
        {
            UserId = "op1",
            StationId = StationCatalog.AssemblyLine1,
            ShiftCode = ShiftCatalog.ShiftA,
            OperatorName = "Ali",
            StartedAt = started,
            Status = ShiftSessionStatuses.Active
        };
        db.ShiftSessions.Add(session);
        await db.SaveChangesAsync();

        db.MachineMetrics.AddRange(
            new MachineMetric
            {
                StationId = StationCatalog.AssemblyLine1,
                PlannedProductionSeconds = 60,
                DowntimeSeconds = 0,
                DowntimeReasonCode = DowntimeReasonCatalog.None,
                ShiftCode = ShiftCatalog.ShiftA,
                ShiftSessionId = session.Id,
                IdealCycleTimeSeconds = 2,
                ActualProductionCount = 10,
                GoodProductionCount = 9,
                RecordedAt = started.AddMinutes(10)
            },
            // Same station/window but different session — must be excluded when tagged rows exist.
            new MachineMetric
            {
                StationId = StationCatalog.AssemblyLine1,
                PlannedProductionSeconds = 60,
                DowntimeSeconds = 0,
                DowntimeReasonCode = DowntimeReasonCatalog.None,
                ShiftCode = ShiftCatalog.ShiftA,
                ShiftSessionId = null,
                IdealCycleTimeSeconds = 2,
                ActualProductionCount = 100,
                GoodProductionCount = 100,
                RecordedAt = started.AddMinutes(15)
            });
        db.ScrapLogs.Add(new ScrapLog
        {
            StationId = StationCatalog.AssemblyLine1,
            Quantity = 2,
            ShiftSessionId = session.Id,
            OperatorUserId = "op1",
            RecordedAt = started.AddMinutes(12)
        });
        await db.SaveChangesAsync();

        var summary = await ShiftSessionAggregator.BuildAsync(db, session);

        Assert.Equal(10, summary.ActualCount);
        Assert.Equal(9, summary.GoodCount);
        Assert.Equal(1, summary.NokCount);
        Assert.Equal(2, summary.ScrapLogQuantity);
        Assert.NotNull(summary.OeePercent);
    }

    [Fact]
    public async Task BuildAsync_falls_back_to_time_window_for_untagged_metrics()
    {
        await using var db = CreateContext();
        var started = DateTimeOffset.UtcNow.AddHours(-1);
        var session = new ShiftSession
        {
            UserId = "op1",
            StationId = StationCatalog.AssemblyLine1,
            ShiftCode = ShiftCatalog.ShiftB,
            OperatorName = "Ali",
            StartedAt = started,
            Status = ShiftSessionStatuses.Active
        };
        db.ShiftSessions.Add(session);
        await db.SaveChangesAsync();

        db.MachineMetrics.Add(new MachineMetric
        {
            StationId = StationCatalog.AssemblyLine1,
            PlannedProductionSeconds = 120,
            DowntimeSeconds = 20,
            DowntimeReasonCode = DowntimeReasonCatalog.Breakdown,
            ShiftCode = ShiftCatalog.ShiftB,
            ShiftSessionId = null,
            IdealCycleTimeSeconds = 2,
            ActualProductionCount = 40,
            GoodProductionCount = 35,
            RecordedAt = started.AddMinutes(5)
        });
        await db.SaveChangesAsync();

        var summary = await ShiftSessionAggregator.BuildAsync(db, session);

        Assert.Equal(40, summary.ActualCount);
        Assert.Equal(35, summary.GoodCount);
        Assert.Equal(5, summary.NokCount);
        Assert.Equal(20, summary.DowntimeSeconds);
    }

    [Fact]
    public void ApplyPersistedSummary_roundtrips_via_FromPersisted()
    {
        var session = new ShiftSession
        {
            UserId = "op1",
            StationId = StationCatalog.AssemblyLine1,
            ShiftCode = ShiftCatalog.ShiftA,
            OperatorName = "Ali",
            StartedAt = DateTimeOffset.UtcNow.AddMinutes(-45),
            EndedAt = DateTimeOffset.UtcNow,
            Status = ShiftSessionStatuses.Ended
        };
        var summary = new MiniMesApi.DTOs.ShiftSessionSummaryDto
        {
            DurationMinutes = 45,
            ActualCount = 100,
            GoodCount = 90,
            NokCount = 10,
            ScrapLogQuantity = 3,
            DowntimeSeconds = 120,
            OeePercent = 72.5
        };

        ShiftSessionAggregator.ApplyPersistedSummary(session, summary);
        var restored = ShiftSessionAggregator.FromPersisted(session);

        Assert.NotNull(restored);
        Assert.Equal(90, restored.GoodCount);
        Assert.Equal(10, restored.NokCount);
        Assert.Equal(3, restored.ScrapLogQuantity);
        Assert.Equal(100, restored.ActualCount);
        Assert.Equal(120, restored.DowntimeSeconds);
        Assert.Equal(72.5, restored.OeePercent);
        Assert.False(string.IsNullOrWhiteSpace(session.SummaryJson));
    }
}
