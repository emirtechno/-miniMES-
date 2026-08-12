using Microsoft.EntityFrameworkCore;
using MiniMesApi.Models;

namespace MiniMesApi.Services;

// NEDEN: Her metrik tick'indeki GoodProductionCount, açık iş emirlerinin CompletedQuantity'sine yansır (WO-only; lot/batch yok).
// Simülasyon/PLC üretimi böylece İş Emri Takibi panosunu otomatik ilerletir.
// NASIL: İstasyonda önce InProgress, yoksa Waiting (otomatik başlat) WO bul → kalan kapasiteye kadar uygula → taşan adet sonraki WO'ya.
public interface IProductionProgressSync
{
    Task ApplyGoodUnitsAsync(string stationId, int goodUnits, CancellationToken cancellationToken = default);
}

public sealed class ProductionProgressSync(MesDbContext context) : IProductionProgressSync
{
    public async Task ApplyGoodUnitsAsync(string stationId, int goodUnits, CancellationToken cancellationToken = default)
    {
        if (goodUnits <= 0 || string.IsNullOrWhiteSpace(stationId)) return;

        var remaining = goodUnits;
        // NEDEN: Bu çağrıda işlenen WO'ları hariç tut. EF identity resolution, SaveChanges öncesi
        // Completed olmuş tracked WO'yu InProgress filtresine uymayan halde yeniden getirebilir.
        var processedWorkOrderIds = new HashSet<int>();

        while (remaining > 0)
        {
            var workOrder = await ResolveActiveWorkOrderAsync(stationId, processedWorkOrderIds, cancellationToken);
            if (workOrder is null) break;
            processedWorkOrderIds.Add(workOrder.Id);

            var roomOnWo = Math.Max(0, workOrder.Quantity - workOrder.CompletedQuantity);
            if (roomOnWo <= 0)
            {
                workOrder.CompletedQuantity = workOrder.Quantity;
                workOrder.Status = WorkOrderStatuses.Completed;
                continue;
            }

            var apply = Math.Min(remaining, roomOnWo);
            workOrder.CompletedQuantity += apply;
            if (workOrder.CompletedQuantity >= workOrder.Quantity)
            {
                workOrder.CompletedQuantity = workOrder.Quantity;
                workOrder.Status = WorkOrderStatuses.Completed;
            }
            else
            {
                workOrder.Status = WorkOrderStatuses.InProgress;
            }

            remaining -= apply;
            if (workOrder.Status != WorkOrderStatuses.Completed)
            {
                break;
            }
        }

        await context.SaveChangesAsync(cancellationToken);
    }

    // NEDEN: Soft-delete (DeletedAt) ve Arşivlendi hariç; önce Devam Ediyor, sonra Bekliyor (auto-start).
    private async Task<WorkOrder?> ResolveActiveWorkOrderAsync(
        string stationId,
        IReadOnlySet<int> excludeIds,
        CancellationToken cancellationToken)
    {
        var inProgressQuery = context.WorkOrders
            .Where(order => order.Station == stationId
                && order.DeletedAt == null
                && order.Status == WorkOrderStatuses.InProgress
                && order.CompletedQuantity < order.Quantity);
        if (excludeIds.Count > 0)
        {
            inProgressQuery = inProgressQuery.Where(order => !excludeIds.Contains(order.Id));
        }

        var inProgress = await inProgressQuery
            .OrderBy(order => order.Id)
            .FirstOrDefaultAsync(cancellationToken);
        // NEDEN: Identity resolution filtrelere uymayan tracked entity döndürebilir — durum tekrar doğrulanır.
        if (inProgress is not null
            && inProgress.Status == WorkOrderStatuses.InProgress
            && inProgress.CompletedQuantity < inProgress.Quantity
            && !excludeIds.Contains(inProgress.Id))
        {
            return inProgress;
        }

        var waitingQuery = context.WorkOrders
            .Where(order => order.Station == stationId
                && order.DeletedAt == null
                && order.Status == WorkOrderStatuses.Waiting
                && order.CompletedQuantity < order.Quantity);
        if (excludeIds.Count > 0)
        {
            waitingQuery = waitingQuery.Where(order => !excludeIds.Contains(order.Id));
        }

        var waiting = await waitingQuery
            .OrderBy(order => order.Id)
            .FirstOrDefaultAsync(cancellationToken);
        if (waiting is null
            || waiting.Status != WorkOrderStatuses.Waiting
            || waiting.CompletedQuantity >= waiting.Quantity
            || excludeIds.Contains(waiting.Id))
        {
            return null;
        }

        // NEDEN: Telemetry iyi adet gelince Bekliyor WO otomatik Devam Ediyor olur (simülasyon / aktif üretim).
        waiting.Status = WorkOrderStatuses.InProgress;
        return waiting;
    }
}
