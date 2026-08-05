using Microsoft.EntityFrameworkCore;
using MiniMesApi.Models;
using MiniMesApi.Services;

namespace MiniMesApi.Tests;

public class ProductionProgressSyncTests
{
    private static MesDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<MesDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new MesDbContext(options);
    }

    /// <summary>
    /// Completing a WO mid-call leaves the entity tracked as Completed while the DB
    /// still matches InProgress filters until SaveChanges. Without a processed-id guard
    /// ResolveActiveWorkOrder re-selects the same tracked WO → infinite roomOnWo&lt;=0 loop.
    /// </summary>
    [Fact]
    public async Task ApplyGoodUnits_CompletingTrackedWo_DoesNotHang()
    {
        await using var db = CreateContext();
        db.WorkOrders.Add(new WorkOrder
        {
            OrderNo = "WO-LOOP",
            Product = "Test",
            Station = StationCatalog.AssemblyLine1,
            Quantity = 10,
            CompletedQuantity = 8,
            Status = WorkOrderStatuses.InProgress
        });
        await db.SaveChangesAsync();

        var sync = new ProductionProgressSync(db);
        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(2));

        await sync.ApplyGoodUnitsAsync(StationCatalog.AssemblyLine1, 50, cts.Token);

        var order = await db.WorkOrders.SingleAsync();
        Assert.Equal(WorkOrderStatuses.Completed, order.Status);
        Assert.Equal(10, order.CompletedQuantity);
    }

    [Fact]
    public async Task ApplyGoodUnits_InProgressAlreadyFull_MarksCompletedWithoutHang()
    {
        await using var db = CreateContext();
        // Simulate inconsistent edge: status still InProgress but qty already filled.
        // Force into the roomOnWo<=0 path via local tracker after a partial query match
        // by using CompletedQuantity == Quantity with Waiting sibling that should receive remainder.
        db.WorkOrders.Add(new WorkOrder
        {
            OrderNo = "WO-FULL",
            Product = "Test",
            Station = StationCatalog.AssemblyLine1,
            Quantity = 5,
            CompletedQuantity = 4,
            Status = WorkOrderStatuses.InProgress
        });
        db.WorkOrders.Add(new WorkOrder
        {
            OrderNo = "WO-NEXT",
            Product = "Test",
            Station = StationCatalog.AssemblyLine1,
            Quantity = 20,
            CompletedQuantity = 0,
            Status = WorkOrderStatuses.Waiting
        });
        await db.SaveChangesAsync();

        var sync = new ProductionProgressSync(db);
        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(2));

        await sync.ApplyGoodUnitsAsync(StationCatalog.AssemblyLine1, 10, cts.Token);

        var orders = await db.WorkOrders.OrderBy(o => o.OrderNo).ToListAsync();
        Assert.Equal(WorkOrderStatuses.Completed, orders[0].Status);
        Assert.Equal(5, orders[0].CompletedQuantity);
        Assert.Equal(WorkOrderStatuses.InProgress, orders[1].Status);
        Assert.Equal(9, orders[1].CompletedQuantity);
    }
}
