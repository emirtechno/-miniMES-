using Microsoft.EntityFrameworkCore;
using MiniMesApi.Models;

namespace MiniMesApi.Services;

/// <summary>
/// Advances open lots and work orders from per-tick GoodProductionCount deltas.
/// Replaces LotTelemetrySync as the single production progress orchestrator.
/// </summary>
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
        // Exclude WOs already handled in this call. EF identity resolution can re-surface a
        // tracked Completed WO while the DB row still matches InProgress filters (pre-SaveChanges).
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
            await ApplyToLotsAsync(workOrder, stationId, apply, cancellationToken);

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

    private async Task<WorkOrder?> ResolveActiveWorkOrderAsync(
        string stationId,
        IReadOnlySet<int> excludeIds,
        CancellationToken cancellationToken)
    {
        var inProgressQuery = context.WorkOrders
            .Where(order => order.Station == stationId
                && order.Status == WorkOrderStatuses.InProgress
                && order.CompletedQuantity < order.Quantity);
        if (excludeIds.Count > 0)
        {
            inProgressQuery = inProgressQuery.Where(order => !excludeIds.Contains(order.Id));
        }

        var inProgress = await inProgressQuery
            .OrderBy(order => order.Id)
            .FirstOrDefaultAsync(cancellationToken);
        // Identity resolution may return a tracked entity that no longer matches filters.
        if (inProgress is not null
            && inProgress.Status == WorkOrderStatuses.InProgress
            && inProgress.CompletedQuantity < inProgress.Quantity
            && !excludeIds.Contains(inProgress.Id))
        {
            return inProgress;
        }

        var waitingQuery = context.WorkOrders
            .Where(order => order.Station == stationId
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

        // Auto-start waiting WO when telemetry good arrives (simulation / active production).
        waiting.Status = WorkOrderStatuses.InProgress;
        return waiting;
    }

    private async Task ApplyToLotsAsync(
        WorkOrder workOrder,
        string stationId,
        int goodUnits,
        CancellationToken cancellationToken)
    {
        var openBatches = await context.Batches
            .Where(batch => batch.Status != BatchStatuses.Completed
                && batch.ProducedQuantity < batch.TargetQuantity
                && (batch.WorkOrderId == workOrder.Id
                    || (batch.WorkOrderId == null && batch.Station == stationId)))
            .OrderBy(batch => batch.WorkOrderId == workOrder.Id ? 0 : 1)
            .ThenBy(batch => batch.Id)
            .ToListAsync(cancellationToken);

        if (openBatches.Count == 0) return;

        var remaining = goodUnits;
        foreach (var batch in openBatches)
        {
            if (remaining <= 0) break;

            // Legacy demo targets (~50–200) fill in one ~120-unit tick — scale before applying.
            if (batch.TargetQuantity > 0 && batch.TargetQuantity < 500)
            {
                batch.TargetQuantity = 1000;
            }

            batch.WorkOrderId ??= workOrder.Id;

            var room = Math.Max(0, batch.TargetQuantity - batch.ProducedQuantity);
            if (room <= 0) continue;
            var apply = Math.Min(room, remaining);
            batch.ProducedQuantity += apply;
            batch.Status = batch.ProducedQuantity >= batch.TargetQuantity
                ? BatchStatuses.Completed
                : BatchStatuses.InProgress;
            batch.UpdatedAt = DateTimeOffset.UtcNow;
            remaining -= apply;
        }
    }
}
