using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using MiniMesApi.Controllers;
using MiniMesApi.DTOs;
using MiniMesApi.Models;

namespace MiniMesApi.Tests;

/// <summary>K2 — BatchStatuses transitions + Advance/Reopen return 409 on invalid paths.</summary>
public sealed class BatchLifecycleTests
{
    [Theory]
    [InlineData(BatchStatuses.Waiting, BatchStatuses.InProgress)]
    [InlineData(BatchStatuses.InProgress, BatchStatuses.Completed)]
    public void TryAdvance_moves_forward(string current, string expected)
    {
        Assert.True(BatchStatuses.TryAdvance(current, out var next, out var error));
        Assert.Equal(expected, next);
        Assert.Null(error);
    }

    [Fact]
    public void TryAdvance_rejects_completed()
    {
        Assert.False(BatchStatuses.TryAdvance(BatchStatuses.Completed, out _, out var error));
        Assert.Contains("Tamamlanan", error);
    }

    [Fact]
    public void TryReopen_only_from_completed()
    {
        Assert.True(BatchStatuses.TryReopen(BatchStatuses.Completed, out var next, out var error));
        Assert.Equal(BatchStatuses.InProgress, next);
        Assert.Null(error);

        Assert.False(BatchStatuses.TryReopen(BatchStatuses.InProgress, out _, out var reopenError));
        Assert.Contains("Tamamlandı", reopenError);
    }

    [Fact]
    public async Task Advance_completed_batch_returns_409()
    {
        await using var db = TestDb.CreateContext();
        var batch = new Batch
        {
            LotNo = "LOT-K2-ADV",
            Product = "Test",
            Station = StationCatalog.AssemblyLine1,
            Status = BatchStatuses.Completed,
            TargetQuantity = 1000,
            ProducedQuantity = 1000,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        db.Batches.Add(batch);
        await db.SaveChangesAsync();

        var controller = new BatchController(db);
        var result = await controller.AdvanceBatch(batch.Id, CancellationToken.None);

        var problem = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(StatusCodes.Status409Conflict, problem.StatusCode);
    }

    [Fact]
    public async Task Reopen_in_progress_batch_returns_409()
    {
        await using var db = TestDb.CreateContext();
        var batch = new Batch
        {
            LotNo = "LOT-K2-REOPEN",
            Product = "Test",
            Station = StationCatalog.AssemblyLine1,
            Status = BatchStatuses.InProgress,
            TargetQuantity = 1000,
            ProducedQuantity = 100,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        db.Batches.Add(batch);
        await db.SaveChangesAsync();

        var controller = new BatchController(db);
        var result = await controller.ReopenBatch(batch.Id, CancellationToken.None);

        var problem = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(StatusCodes.Status409Conflict, problem.StatusCode);
    }

    [Fact]
    public async Task Advance_waiting_persists_in_progress()
    {
        await using var db = TestDb.CreateContext();
        var batch = new Batch
        {
            LotNo = "LOT-K2-OK",
            Product = "Test",
            Station = StationCatalog.AssemblyLine1,
            Status = BatchStatuses.Waiting,
            TargetQuantity = 1000,
            ProducedQuantity = 0,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        db.Batches.Add(batch);
        await db.SaveChangesAsync();

        var controller = new BatchController(db);
        var result = await controller.AdvanceBatch(batch.Id, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var dto = Assert.IsType<BatchDto>(ok.Value);
        Assert.Equal(BatchStatuses.InProgress, dto.Status);

        await db.Entry(batch).ReloadAsync();
        Assert.Equal(BatchStatuses.InProgress, batch.Status);
    }

    [Fact]
    public async Task Reopen_completed_persists_in_progress()
    {
        await using var db = TestDb.CreateContext();
        var batch = new Batch
        {
            LotNo = "LOT-K2-REOPEN-OK",
            Product = "Test",
            Station = StationCatalog.AssemblyLine1,
            Status = BatchStatuses.Completed,
            TargetQuantity = 1000,
            ProducedQuantity = 1000,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        db.Batches.Add(batch);
        await db.SaveChangesAsync();

        var controller = new BatchController(db);
        var result = await controller.ReopenBatch(batch.Id, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var dto = Assert.IsType<BatchDto>(ok.Value);
        Assert.Equal(BatchStatuses.InProgress, dto.Status);

        await db.Entry(batch).ReloadAsync();
        Assert.Equal(BatchStatuses.InProgress, batch.Status);
        Assert.True(batch.ProducedQuantity < batch.TargetQuantity);
    }
}
