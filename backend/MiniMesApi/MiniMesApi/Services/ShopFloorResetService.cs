using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using MiniMesApi.DTOs;
using MiniMesApi.Models;

namespace MiniMesApi.Services;

/// <summary>
/// Destructive demo reset for shop-floor telemetry / sessions.
/// Keeps Identity users, products, stations catalog, and simulation gate.
/// </summary>
public interface IShopFloorResetService
{
    Task<ShopFloorResetResultDto> ResetAsync(string requestedBy, CancellationToken cancellationToken = default);
}

public sealed class ShopFloorResetService(MesDbContext db) : IShopFloorResetService
{
    public const string ConfirmationPhrase = "SIFIRLA";

    public async Task<ShopFloorResetResultDto> ResetAsync(
        string requestedBy,
        CancellationToken cancellationToken = default)
    {
        // EnableRetryOnFailure requires user-initiated transactions to run inside the
        // strategy returned by CreateExecutionStrategy (retriable unit).
        var strategy = db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(
            () => ResetInTransactionAsync(requestedBy, cancellationToken));
    }

    private async Task<ShopFloorResetResultDto> ResetInTransactionAsync(
        string requestedBy,
        CancellationToken cancellationToken)
    {
        IDbContextTransaction? tx = null;
        if (db.Database.IsRelational())
            tx = await db.Database.BeginTransactionAsync(cancellationToken);

        try
        {
            // Immediate deletes in FK-safe order — never one SaveChanges over the whole graph.
            // DowntimeEvents / ScrapLogs reference Alarm + MachineMetric + ShiftSession (SetNull).
            var downtimeEvents = await WipeAsync(db.DowntimeEvents, cancellationToken);
            var scrapLogs = await WipeAsync(db.ScrapLogs, cancellationToken);
            var shiftSessionEvents = await WipeAsync(db.ShiftSessionEvents, cancellationToken);
            var alarms = await WipeAsync(db.Alarms, cancellationToken);
            var metrics = await WipeAsync(db.MachineMetrics, cancellationToken);
            var uretim = await WipeAsync(db.UretimKayitlari, cancellationToken);
            var sessions = await WipeAsync(db.ShiftSessions, cancellationToken);

            var now = DateTimeOffset.UtcNow;
            var runtimes = await ResetStationRuntimesAsync(now, cancellationToken);
            var workOrders = await ClearWorkOrderProgressAsync(cancellationToken);
            var batches = await ClearBatchProgressAsync(cancellationToken);

            if (tx is not null)
                await tx.CommitAsync(cancellationToken);

            return new ShopFloorResetResultDto
            {
                ResetAt = now,
                RequestedBy = string.IsNullOrWhiteSpace(requestedBy) ? "unknown" : requestedBy.Trim(),
                MachineMetricsDeleted = metrics,
                ScrapLogsDeleted = scrapLogs,
                AlarmsDeleted = alarms,
                DowntimeEventsDeleted = downtimeEvents,
                ShiftSessionEventsDeleted = shiftSessionEvents,
                ShiftSessionsDeleted = sessions,
                StationRuntimesReset = runtimes,
                WorkOrdersProgressCleared = workOrders,
                BatchesProgressCleared = batches,
                UretimKayitlariDeleted = uretim
            };
        }
        catch (DbUpdateConcurrencyException ex)
        {
            if (tx is not null)
                await tx.RollbackAsync(cancellationToken);
            throw new InvalidOperationException(
                "Shop-floor sıfırlama eşzamanlılık çakışması nedeniyle tamamlanamadı. Simülasyonu durdurup tekrar deneyin.",
                ex);
        }
        catch (DbUpdateException ex)
        {
            if (tx is not null)
                await tx.RollbackAsync(cancellationToken);
            throw new InvalidOperationException(
                "Shop-floor sıfırlama veritabanı kısıtı nedeniyle başarısız oldu. Ayrıntılar sunucu günlüklerinde.",
                ex);
        }
        catch
        {
            if (tx is not null)
                await tx.RollbackAsync(cancellationToken);
            throw;
        }
        finally
        {
            if (tx is not null)
                await tx.DisposeAsync();
        }
    }

    /// <summary>
    /// SQL Server: ExecuteDelete (immediate). InMemory tests: RemoveRange + SaveChanges per table.
    /// </summary>
    private async Task<int> WipeAsync<TEntity>(
        DbSet<TEntity> set,
        CancellationToken cancellationToken)
        where TEntity : class
    {
        if (db.Database.IsRelational())
            return await set.ExecuteDeleteAsync(cancellationToken);

        var rows = await set.ToListAsync(cancellationToken);
        if (rows.Count == 0)
            return 0;
        set.RemoveRange(rows);
        await db.SaveChangesAsync(cancellationToken);
        return rows.Count;
    }

    private async Task<int> ResetStationRuntimesAsync(DateTimeOffset now, CancellationToken cancellationToken)
    {
        if (db.Database.IsRelational())
        {
            return await db.StationRuntimes.ExecuteUpdateAsync(
                setters => setters
                    .SetProperty(runtime => runtime.Mode, StationRuntimeModes.Paused)
                    .SetProperty(runtime => runtime.PauseReason, "Shop-floor reset")
                    .SetProperty(runtime => runtime.NextAnomalyAllowedAt, (DateTimeOffset?)null)
                    .SetProperty(runtime => runtime.UpdatedAt, now),
                cancellationToken);
        }

        var runtimes = await db.StationRuntimes.ToListAsync(cancellationToken);
        foreach (var runtime in runtimes)
        {
            runtime.Mode = StationRuntimeModes.Paused;
            runtime.PauseReason = "Shop-floor reset";
            runtime.NextAnomalyAllowedAt = null;
            runtime.UpdatedAt = now;
        }

        if (runtimes.Count > 0)
            await db.SaveChangesAsync(cancellationToken);
        return runtimes.Count;
    }

    private async Task<int> ClearWorkOrderProgressAsync(CancellationToken cancellationToken)
    {
        // ExecuteUpdate bypasses RowVersion; tracked updates can collide with the sim worker.
        if (db.Database.IsRelational())
        {
            return await db.WorkOrders
                .Where(wo => wo.CompletedQuantity != 0)
                .ExecuteUpdateAsync(
                    setters => setters.SetProperty(wo => wo.CompletedQuantity, 0),
                    cancellationToken);
        }

        var workOrders = await db.WorkOrders
            .Where(wo => wo.CompletedQuantity != 0)
            .ToListAsync(cancellationToken);
        foreach (var wo in workOrders)
            wo.CompletedQuantity = 0;
        if (workOrders.Count > 0)
            await db.SaveChangesAsync(cancellationToken);
        return workOrders.Count;
    }

    private async Task<int> ClearBatchProgressAsync(CancellationToken cancellationToken)
    {
        if (db.Database.IsRelational())
        {
            return await db.Batches
                .Where(batch => batch.ProducedQuantity != 0)
                .ExecuteUpdateAsync(
                    setters => setters.SetProperty(batch => batch.ProducedQuantity, 0),
                    cancellationToken);
        }

        var batches = await db.Batches
            .Where(batch => batch.ProducedQuantity != 0)
            .ToListAsync(cancellationToken);
        foreach (var batch in batches)
            batch.ProducedQuantity = 0;
        if (batches.Count > 0)
            await db.SaveChangesAsync(cancellationToken);
        return batches.Count;
    }
}
