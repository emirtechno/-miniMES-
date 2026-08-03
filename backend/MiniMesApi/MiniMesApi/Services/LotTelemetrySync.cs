using Microsoft.EntityFrameworkCore;
using MiniMesApi.Models;

namespace MiniMesApi.Services;

/// <summary>
/// Advances open lots from Live Stream / PLC batch ticks (GoodProductionCount deltas).
/// </summary>
public interface ILotTelemetrySync
{
    Task ApplyGoodUnitsAsync(string stationId, int goodUnits, CancellationToken cancellationToken = default);
}

public sealed class LotTelemetrySync(MesDbContext context) : ILotTelemetrySync
{
    public async Task ApplyGoodUnitsAsync(string stationId, int goodUnits, CancellationToken cancellationToken = default)
    {
        if (goodUnits <= 0 || string.IsNullOrWhiteSpace(stationId)) return;

        var openBatches = await context.Batches
            .Where(batch => batch.Station == stationId
                && batch.Status != BatchStatuses.Completed
                && batch.ProducedQuantity < batch.TargetQuantity)
            .OrderBy(batch => batch.Id)
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

        await context.SaveChangesAsync(cancellationToken);
    }
}
