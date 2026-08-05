using Microsoft.EntityFrameworkCore;
using MiniMesApi.DTOs;
using MiniMesApi.Models;
using MiniMesApi.Services;
using MiniMesApi.Validators;

namespace MiniMesApi.Tests;

public sealed class MetricIngestShiftSessionTests
{
    private static MesDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<MesDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new MesDbContext(options);
    }

    private static MetricIngestService CreateIngest(MesDbContext db) =>
        new(
            db,
            new CreateMachineMetricDtoValidator(),
            new ProductionProgressSync(db),
            new TelemetryAnomalyService(db, new NoopRealtimePublisher(), new StationRuntimeService(db)),
            new NoopRealtimePublisher());

    [Fact]
    public async Task Ingest_tags_open_ShiftSession_but_stamps_catalog_ShiftCode()
    {
        await using var db = CreateContext();
        db.ShiftSessions.Add(new ShiftSession
        {
            UserId = "op1",
            StationId = StationCatalog.AssemblyLine1,
            ShiftCode = ShiftCatalog.ShiftC,
            OperatorName = "Ali",
            StartedAt = DateTimeOffset.UtcNow.AddMinutes(-10),
            Status = ShiftSessionStatuses.Active
        });
        await db.SaveChangesAsync();

        // Fixed daytime UTC → catalog SHIFT_A, even though session claims SHIFT_C.
        var recordedAt = new DateTimeOffset(2026, 8, 5, 10, 30, 0, TimeSpan.Zero);
        var ingest = CreateIngest(db);
        var dto = await ingest.IngestAsync(new CreateMachineMetricDto
        {
            StationId = StationCatalog.AssemblyLine1,
            PlannedProductionSeconds = 60,
            DowntimeSeconds = 0,
            DowntimeReasonCode = DowntimeReasonCatalog.None,
            ShiftCode = ShiftCatalog.ShiftB,
            IdealCycleTimeSeconds = 2,
            ActualProductionCount = 5,
            GoodProductionCount = 5,
            RecordedAt = recordedAt
        });

        Assert.Equal(ShiftCatalog.ShiftA, dto.ShiftCode);
        Assert.NotNull(dto.ShiftSessionId);

        var stored = await db.MachineMetrics.SingleAsync();
        Assert.Equal(dto.ShiftSessionId, stored.ShiftSessionId);
        Assert.Equal(ShiftCatalog.ShiftA, stored.ShiftCode);
    }

    [Fact]
    public async Task Ingest_leaves_ShiftSessionId_null_when_no_open_session()
    {
        await using var db = CreateContext();
        var ingest = CreateIngest(db);
        var recordedAt = new DateTimeOffset(2026, 8, 5, 10, 30, 0, TimeSpan.Zero);

        var dto = await ingest.IngestAsync(new CreateMachineMetricDto
        {
            StationId = StationCatalog.AssemblyLine1,
            PlannedProductionSeconds = 60,
            DowntimeSeconds = 0,
            DowntimeReasonCode = DowntimeReasonCatalog.None,
            ShiftCode = ShiftCatalog.ShiftC, // ignored — catalog from RecordedAt
            IdealCycleTimeSeconds = 2,
            ActualProductionCount = 3,
            GoodProductionCount = 3,
            RecordedAt = recordedAt
        });

        Assert.Null(dto.ShiftSessionId);
        Assert.Equal(ShiftCatalog.ShiftA, dto.ShiftCode);
    }

    [Fact]
    public async Task Ingest_tags_OnBreak_session_with_catalog_ShiftCode()
    {
        await using var db = CreateContext();
        db.ShiftSessions.Add(new ShiftSession
        {
            UserId = "op1",
            StationId = StationCatalog.AssemblyLine1,
            ShiftCode = ShiftCatalog.ShiftB,
            OperatorName = "Ali",
            StartedAt = DateTimeOffset.UtcNow.AddMinutes(-30),
            Status = ShiftSessionStatuses.OnBreak,
            BreakReason = "NO_OPERATOR"
        });
        await db.SaveChangesAsync();

        var recordedAt = new DateTimeOffset(2026, 8, 5, 10, 30, 0, TimeSpan.Zero);
        var ingest = CreateIngest(db);
        var dto = await ingest.IngestAsync(new CreateMachineMetricDto
        {
            StationId = StationCatalog.AssemblyLine1,
            PlannedProductionSeconds = 60,
            DowntimeSeconds = 60,
            DowntimeReasonCode = DowntimeReasonCatalog.NoOperator,
            IdealCycleTimeSeconds = 2,
            ActualProductionCount = 0,
            GoodProductionCount = 0,
            RecordedAt = recordedAt
        });

        Assert.NotNull(dto.ShiftSessionId);
        Assert.Equal(ShiftCatalog.ShiftA, dto.ShiftCode);
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
