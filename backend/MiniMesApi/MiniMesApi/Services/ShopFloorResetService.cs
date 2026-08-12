using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using MiniMesApi.DTOs;
using MiniMesApi.Models;

namespace MiniMesApi.Services;

// NEDEN: Demo / eğitim için shop-floor telemetri ve oturumları yıkıcı sıfırlar.
// Identity kullanıcıları, ürünler, istasyon kataloğu ve simülasyon kapısı korunur.
// NASIL: ConfirmationPhrase "SIFIRLA" (controller); FK-güvenli sırada ExecuteDelete; runtime Paused; WO CompletedQuantity=0.
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
        // NEDEN: EnableRetryOnFailure, kullanıcı transaction'larının CreateExecutionStrategy içinde çalışmasını ister.
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
            // NEDEN: FK-güvenli sırada anında sil — tüm grafa tek SaveChanges yok.
            // DowntimeEvents / ScrapLogs → Alarm + MachineMetric + ShiftSession (SetNull) referansları.
            // NASIL: Downtime → Scrap → ShiftSessionEvents → Alarms → Metrics → Uretim → Sessions → Runtime reset → WO progress clear.
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

    // NEDEN: SQL Server → ExecuteDelete (anında); InMemory testler → RemoveRange + SaveChanges tablo başına.
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

    // NEDEN: Runtime'ı Paused + "Shop-floor reset" yap; anomali cooldown sıfırlanır (hemen yeni alarm açılabilir).
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

    // NEDEN: WO satırlarını silme — sadece CompletedQuantity=0 (plan korunur). ExecuteUpdate RowVersion'ı atlar (sim worker çakışması).
    private async Task<int> ClearWorkOrderProgressAsync(CancellationToken cancellationToken)
    {
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
}
