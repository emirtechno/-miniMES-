using MiniMesApi.Models;
using MiniMesApi.Services;

namespace MiniMesApi.Tests;

/// <summary>K3 — good-unit write path advances open batch via ILotTelemetrySync.</summary>
public sealed class LotTelemetrySyncTests
{
    [Fact]
    public async Task ApplyGoodUnits_updates_produced_quantity_and_status()
    {
        await using var db = TestDb.CreateContext();
        var station = StationCatalog.AssemblyLine1;
        db.Batches.Add(new Batch
        {
            LotNo = "LOT-K3-1",
            Product = "Kit",
            Station = station,
            Status = BatchStatuses.Waiting,
            TargetQuantity = 1000,
            ProducedQuantity = 0,
            UpdatedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();

        var sync = new LotTelemetrySync(db);
        await sync.ApplyGoodUnitsAsync(station, goodUnits: 120);

        var batch = Assert.Single(db.Batches);
        Assert.Equal(120, batch.ProducedQuantity);
        Assert.Equal(BatchStatuses.InProgress, batch.Status);
    }

    [Fact]
    public async Task ApplyGoodUnits_completes_batch_at_target()
    {
        await using var db = TestDb.CreateContext();
        var station = StationCatalog.ElectronicsBoardAssembly;
        db.Batches.Add(new Batch
        {
            LotNo = "LOT-K3-2",
            Product = "Kart",
            Station = station,
            Status = BatchStatuses.InProgress,
            TargetQuantity = 1000, // >= 500 so legacy scale-up does not rewrite target
            ProducedQuantity = 980,
            UpdatedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();

        var sync = new LotTelemetrySync(db);
        await sync.ApplyGoodUnitsAsync(station, goodUnits: 25);

        var batch = Assert.Single(db.Batches);
        Assert.Equal(1000, batch.ProducedQuantity);
        Assert.Equal(BatchStatuses.Completed, batch.Status);
    }

    [Fact]
    public async Task ApplyGoodUnits_ignores_completed_batches()
    {
        await using var db = TestDb.CreateContext();
        var station = StationCatalog.PackagingLine1;
        db.Batches.Add(new Batch
        {
            LotNo = "LOT-K3-DONE",
            Product = "Paket",
            Station = station,
            Status = BatchStatuses.Completed,
            TargetQuantity = 500,
            ProducedQuantity = 500,
            UpdatedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();

        var sync = new LotTelemetrySync(db);
        await sync.ApplyGoodUnitsAsync(station, goodUnits: 50);

        var batch = Assert.Single(db.Batches);
        Assert.Equal(500, batch.ProducedQuantity);
        Assert.Equal(BatchStatuses.Completed, batch.Status);
    }
}
