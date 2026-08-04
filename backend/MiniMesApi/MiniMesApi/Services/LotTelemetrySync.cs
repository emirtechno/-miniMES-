using System.Collections.Concurrent;
using Microsoft.EntityFrameworkCore;
using MiniMesApi.Models;

namespace MiniMesApi.Services;

/// <summary>
/// Advances open lots from Live Stream / PLC batch ticks (GoodProductionCount deltas).
/// Completes linked work orders when their executing lot reaches target.
/// </summary>
public interface ILotTelemetrySync
{
    Task ApplyGoodUnitsAsync(string stationId, int goodUnits, CancellationToken cancellationToken = default);
}

public sealed class LotTelemetrySync(MesDbContext context) : ILotTelemetrySync
{
    /// <summary>
    /// Per-station gate so concurrent ingest + OEE sim ticks cannot last-write-wins
    /// ProducedQuantity on the same open lots.
    /// </summary>
    private static readonly ConcurrentDictionary<string, SemaphoreSlim> StationGates = new(StringComparer.Ordinal);

    public async Task ApplyGoodUnitsAsync(string stationId, int goodUnits, CancellationToken cancellationToken = default)
    {
        if (goodUnits <= 0 || string.IsNullOrWhiteSpace(stationId)) return;

        var gate = StationGates.GetOrAdd(stationId, static _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            // SQL Server: wrap in a transaction. InMemory (tests) has no transactions —
            // the station gate still serializes same-process writers.
            if (context.Database.IsRelational())
            {
                await using var tx = await context.Database
                    .BeginTransactionAsync(cancellationToken)
                    .ConfigureAwait(false);

                const int maxAttempts = 3;
                for (var attempt = 1; attempt <= maxAttempts; attempt++)
                {
                    try
                    {
                        await ApplyCoreAsync(stationId, goodUnits, cancellationToken)
                            .ConfigureAwait(false);
                        await tx.CommitAsync(cancellationToken).ConfigureAwait(false);
                        return;
                    }
                    catch (DbUpdateConcurrencyException) when (attempt < maxAttempts)
                    {
                        foreach (var entry in context.ChangeTracker.Entries())
                        {
                            await entry.ReloadAsync(cancellationToken).ConfigureAwait(false);
                        }
                    }
                }
            }
            else
            {
                await ApplyCoreAsync(stationId, goodUnits, cancellationToken).ConfigureAwait(false);
            }
        }
        finally
        {
            gate.Release();
        }
    }

    private async Task ApplyCoreAsync(
        string stationId,
        int goodUnits,
        CancellationToken cancellationToken)
    {
        // Reload open lots under the station lock so concurrent callers see committed state.
        var openBatches = await context.Batches
            .Where(batch => batch.Station == stationId
                && batch.Status != BatchStatuses.Completed
                && batch.ProducedQuantity < batch.TargetQuantity)
            .OrderBy(batch => batch.Id)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        if (openBatches.Count == 0) return;

        var completedWorkOrderIds = new HashSet<int>();
        var remaining = goodUnits;
        foreach (var batch in openBatches)
        {
            if (remaining <= 0) break;

            // Legacy demo targets (~50–200) fill in one ~120-unit tick — scale before applying.
            if (batch.TargetQuantity > 0 && batch.TargetQuantity < 500 && batch.WorkOrderId is null)
            {
                batch.TargetQuantity = 1000;
            }

            var room = Math.Max(0, batch.TargetQuantity - batch.ProducedQuantity);
            if (room <= 0) continue;
            var apply = Math.Min(room, remaining);
            batch.ProducedQuantity += apply;
            batch.Status = batch.ProducedQuantity >= batch.TargetQuantity
                ? BatchStatuses.Completed
                : BatchStatuses.InProgress;
            batch.UpdatedAt = DateTimeOffset.UtcNow;
            remaining -= apply;

            if (batch.Status == BatchStatuses.Completed && batch.WorkOrderId is int workOrderId)
            {
                completedWorkOrderIds.Add(workOrderId);
            }
        }

        if (completedWorkOrderIds.Count > 0)
        {
            var workOrders = await context.WorkOrders
                .Where(order => completedWorkOrderIds.Contains(order.Id))
                .ToListAsync(cancellationToken)
                .ConfigureAwait(false);

            foreach (var order in workOrders)
            {
                // Complete WO when its linked lot hits target (1:1 sim model).
                if (order.Status != WorkOrderStatuses.Completed)
                {
                    order.Status = WorkOrderStatuses.Completed;
                }
            }
        }

        // Soft link: station WO without FK still advances to InProgress on first production.
        var openStationOrders = await context.WorkOrders
            .Where(order => order.Station == stationId && order.Status == WorkOrderStatuses.Waiting)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
        foreach (var order in openStationOrders)
        {
            order.Status = WorkOrderStatuses.InProgress;
        }

        await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }
}
