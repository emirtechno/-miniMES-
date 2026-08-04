using Microsoft.AspNetCore.Mvc;
using MiniMesApi.Controllers;
using MiniMesApi.Models;

namespace MiniMesApi.Tests;

/// <summary>O1 — GET /Batch must not mutate TargetQuantity (read path side-effect free).</summary>
public sealed class BatchGetSideEffectTests
{
    [Fact]
    public async Task GetBatches_does_not_scale_small_target_quantity()
    {
        await using var db = TestDb.CreateContext();
        db.Batches.Add(new Batch
        {
            LotNo = "LOT-O1-SMALL",
            Product = "Demo",
            Station = StationCatalog.AssemblyLine1,
            Status = BatchStatuses.InProgress,
            TargetQuantity = 120, // legacy small target — must stay 120 on GET
            ProducedQuantity = 40,
            UpdatedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();

        var controller = new BatchController(db);
        var result = await controller.GetBatches(limit: 50, cursor: null, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var page = Assert.IsAssignableFrom<MiniMesApi.DTOs.CursorPage<MiniMesApi.DTOs.BatchDto>>(ok.Value);
        var dto = Assert.Single(page.Items);
        Assert.Equal(120, dto.TargetQuantity);

        var persisted = Assert.Single(db.Batches);
        Assert.Equal(120, persisted.TargetQuantity);
        Assert.Equal(40, persisted.ProducedQuantity);
        Assert.Equal(BatchStatuses.InProgress, persisted.Status);
    }

    [Fact]
    public async Task GetBatches_does_not_persist_status_rewrite()
    {
        await using var db = TestDb.CreateContext();
        // Inconsistent store: Waiting with produced > 0 — GET must not SaveChanges to fix it.
        db.Batches.Add(new Batch
        {
            LotNo = "LOT-O1-STATUS",
            Product = "Demo",
            Station = StationCatalog.PackagingLine1,
            Status = BatchStatuses.Waiting,
            TargetQuantity = 1000,
            ProducedQuantity = 50,
            UpdatedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();

        var controller = new BatchController(db);
        _ = await controller.GetBatches(limit: 50, cursor: null, CancellationToken.None);

        var persisted = Assert.Single(db.Batches);
        Assert.Equal(BatchStatuses.Waiting, persisted.Status);
        Assert.Equal(50, persisted.ProducedQuantity);
        Assert.Equal(1000, persisted.TargetQuantity);
    }
}
