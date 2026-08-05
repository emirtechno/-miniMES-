using Microsoft.EntityFrameworkCore;
using MiniMesApi.Models;

namespace MiniMesApi.Services;

public interface IStationRuntimeService
{
    Task<StationRuntime> GetOrCreateAsync(string stationId, CancellationToken cancellationToken = default);
    Task<IReadOnlyDictionary<string, StationRuntime>> GetAllAsync(CancellationToken cancellationToken = default);
    Task PauseForAlarmAsync(string stationId, string title, string severity, CancellationToken cancellationToken = default);
    Task RefreshAfterAlarmResolvedAsync(string stationId, CancellationToken cancellationToken = default);
    /// <summary>
    /// Resume when no blocking alarms remain and the station is not OnBreak/InSetup.
    /// </summary>
    Task<bool> TryAutoResumeAfterClearAsync(string stationId, CancellationToken cancellationToken = default);
    /// <summary>
    /// Per-tick heal: Active shift + no blocking alarms → Running;
    /// OnBreak/InSetup → Paused; open blocking alarm → Paused/Down.
    /// </summary>
    Task<string> HealRuntimeForStationAsync(string stationId, CancellationToken cancellationToken = default);
    /// <summary>
    /// Close operator-initiated downtime/setup hold alarms so resume can proceed.
    /// </summary>
    Task<int> ClearOperatorHoldAlarmsAsync(string stationId, string resolvedBy, CancellationToken cancellationToken = default);
    Task PauseAsync(string stationId, string reason, string mode, CancellationToken cancellationToken = default);
    Task<bool> TryResumeAsync(string stationId, CancellationToken cancellationToken = default);
    Task<bool> HasOpenBlockingAlarmAsync(string stationId, CancellationToken cancellationToken = default);
    Task EnsureSeededAsync(CancellationToken cancellationToken = default);
    Task SyncWithOpenAlarmsAsync(CancellationToken cancellationToken = default);
}

public sealed class StationRuntimeService(MesDbContext context) : IStationRuntimeService
{
    public async Task EnsureSeededAsync(CancellationToken cancellationToken = default)
    {
        var existing = await context.StationRuntimes
            .Select(runtime => runtime.StationId)
            .ToListAsync(cancellationToken);
        var missing = StationCatalog.Active.Where(id => !existing.Contains(id, StringComparer.OrdinalIgnoreCase)).ToList();

        // Catalog-known legacy (Test_Ve_Paketleme) and fully removed ids (Montaj_Hatti_02/03) drop from live runtime.
        var retired = existing.Where(id => !StationCatalog.IsActive(id)).ToList();

        foreach (var stationId in missing)
        {
            context.StationRuntimes.Add(new StationRuntime
            {
                StationId = stationId,
                Mode = StationRuntimeModes.Running,
                UpdatedAt = DateTimeOffset.UtcNow
            });
        }

        if (retired.Count > 0)
        {
            var toRemove = await context.StationRuntimes
                .Where(runtime => retired.Contains(runtime.StationId))
                .ToListAsync(cancellationToken);
            context.StationRuntimes.RemoveRange(toRemove);
        }

        if (missing.Count == 0 && retired.Count == 0) return;

        await context.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// Align StationRuntime with open blocking alarms (e.g. after seed or restart).
    /// </summary>
    public async Task SyncWithOpenAlarmsAsync(CancellationToken cancellationToken = default)
    {
        await EnsureSeededAsync(cancellationToken);
        foreach (var stationId in StationCatalog.Active)
        {
            if (!await HasOpenBlockingAlarmAsync(stationId, cancellationToken))
            {
                continue;
            }

            var runtime = await GetOrCreateAsync(stationId, cancellationToken);
            if (runtime.Mode == StationRuntimeModes.Running)
            {
                var open = await context.Alarms.AsNoTracking()
                    .Where(alarm => alarm.Station == stationId
                        && alarm.Status != "Çözüldü"
                        && alarm.Status != "Kapalı")
                    .OrderByDescending(alarm => alarm.Time)
                    .Select(alarm => new { alarm.Title, alarm.Severity })
                    .FirstOrDefaultAsync(cancellationToken);
                if (open is not null && IsBlocking(open.Title, open.Severity))
                {
                    await PauseForAlarmAsync(stationId, open.Title, open.Severity, cancellationToken);
                }
            }
        }
    }

    public async Task<StationRuntime> GetOrCreateAsync(string stationId, CancellationToken cancellationToken = default)
    {
        var runtime = await context.StationRuntimes.FindAsync([stationId], cancellationToken);
        if (runtime is not null) return runtime;

        runtime = new StationRuntime
        {
            StationId = stationId,
            Mode = StationRuntimeModes.Running,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        context.StationRuntimes.Add(runtime);
        await context.SaveChangesAsync(cancellationToken);
        return runtime;
    }

    public async Task<IReadOnlyDictionary<string, StationRuntime>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        await EnsureSeededAsync(cancellationToken);
        var rows = await context.StationRuntimes.AsNoTracking().ToListAsync(cancellationToken);
        return rows.ToDictionary(row => row.StationId, StringComparer.OrdinalIgnoreCase);
    }

    public async Task PauseForAlarmAsync(
        string stationId,
        string title,
        string severity,
        CancellationToken cancellationToken = default)
    {
        if (!IsBlocking(title, severity)) return;

        var mode = string.Equals(severity, "Kritik", StringComparison.OrdinalIgnoreCase)
            || ContainsAny(title, "Acil", "Emergency", "ARIZA")
            ? StationRuntimeModes.Down
            : StationRuntimeModes.Paused;

        await PauseAsync(stationId, $"Alarm: {title}", mode, cancellationToken);
    }

    public async Task RefreshAfterAlarmResolvedAsync(string stationId, CancellationToken cancellationToken = default)
    {
        if (await TryAutoResumeAfterClearAsync(stationId, cancellationToken))
        {
            return;
        }

        if (await HasOpenBlockingAlarmAsync(stationId, cancellationToken))
        {
            return;
        }

        var runtime = await GetOrCreateAsync(stationId, cancellationToken);
        if (runtime.Mode != StationRuntimeModes.Running)
        {
            runtime.PauseReason = "Alarm çözüldü — operatör Üretime Dön bekleniyor";
            runtime.UpdatedAt = DateTimeOffset.UtcNow;
            await context.SaveChangesAsync(cancellationToken);
        }
    }

    public async Task<bool> TryAutoResumeAfterClearAsync(string stationId, CancellationToken cancellationToken = default)
    {
        if (await HasOpenBlockingAlarmAsync(stationId, cancellationToken))
        {
            return false;
        }

        // Keep intentional operator holds (mola / setup); otherwise restore production.
        var openShift = await context.ShiftSessions.AsNoTracking()
            .Where(session => session.StationId == stationId
                && session.Status != ShiftSessionStatuses.Ended)
            .OrderByDescending(session => session.StartedAt)
            .Select(session => session.Status)
            .FirstOrDefaultAsync(cancellationToken);

        if (openShift is ShiftSessionStatuses.OnBreak or ShiftSessionStatuses.InSetup)
        {
            return false;
        }

        return await TryResumeAsync(stationId, cancellationToken);
    }

    public async Task<string> HealRuntimeForStationAsync(string stationId, CancellationToken cancellationToken = default)
    {
        var openShift = await context.ShiftSessions.AsNoTracking()
            .Where(session => session.StationId == stationId
                && session.Status != ShiftSessionStatuses.Ended)
            .OrderByDescending(session => session.StartedAt)
            .Select(session => session.Status)
            .FirstOrDefaultAsync(cancellationToken);

        var blocked = await HasOpenBlockingAlarmAsync(stationId, cancellationToken);
        var runtime = await GetOrCreateAsync(stationId, cancellationToken);

        if (blocked)
        {
            if (runtime.Mode == StationRuntimeModes.Running)
            {
                var open = await context.Alarms.AsNoTracking()
                    .Where(alarm => alarm.Station == stationId
                        && alarm.Status != "Çözüldü"
                        && alarm.Status != "Kapalı")
                    .OrderByDescending(alarm => alarm.Time)
                    .Select(alarm => new { alarm.Title, alarm.Severity })
                    .FirstOrDefaultAsync(cancellationToken);
                if (open is not null && IsBlocking(open.Title, open.Severity))
                {
                    await PauseForAlarmAsync(stationId, open.Title, open.Severity, cancellationToken);
                    return (await GetOrCreateAsync(stationId, cancellationToken)).Mode;
                }

                await PauseAsync(stationId, "Açık engelleyici alarm", StationRuntimeModes.Paused, cancellationToken);
                return StationRuntimeModes.Paused;
            }

            return runtime.Mode;
        }

        if (openShift is ShiftSessionStatuses.OnBreak or ShiftSessionStatuses.InSetup)
        {
            if (runtime.Mode == StationRuntimeModes.Running)
            {
                var reason = openShift == ShiftSessionStatuses.InSetup
                    ? "Setup / model değişimi"
                    : "Operatör molası / duruş";
                await PauseAsync(stationId, reason, StationRuntimeModes.Paused, cancellationToken);
                return StationRuntimeModes.Paused;
            }

            return runtime.Mode;
        }

        // Active shift (or no intentional hold) + no blocking alarms → Running.
        if (runtime.Mode != StationRuntimeModes.Running)
        {
            await TryResumeAsync(stationId, cancellationToken);
            return (await GetOrCreateAsync(stationId, cancellationToken)).Mode;
        }

        return StationRuntimeModes.Running;
    }

    public async Task<int> ClearOperatorHoldAlarmsAsync(
        string stationId,
        string resolvedBy,
        CancellationToken cancellationToken = default)
    {
        var open = await context.Alarms
            .Where(alarm => alarm.Station == stationId
                && alarm.Status != "Çözüldü"
                && alarm.Status != "Kapalı")
            .ToListAsync(cancellationToken);

        var cleared = 0;
        var now = DateTimeOffset.UtcNow;
        foreach (var alarm in open)
        {
            if (!IsOperatorHoldAlarm(alarm.Title)) continue;

            alarm.Status = "Çözüldü";
            alarm.ResolvedAt = now;
            alarm.ResolvedBy = resolvedBy;
            alarm.AcknowledgedAt ??= now;
            alarm.AcknowledgedBy ??= resolvedBy;
            cleared++;
        }

        if (cleared > 0)
        {
            await context.SaveChangesAsync(cancellationToken);
        }

        return cleared;
    }

    public async Task PauseAsync(
        string stationId,
        string reason,
        string mode,
        CancellationToken cancellationToken = default)
    {
        if (mode is not (StationRuntimeModes.Paused or StationRuntimeModes.Down))
        {
            mode = StationRuntimeModes.Paused;
        }

        var runtime = await GetOrCreateAsync(stationId, cancellationToken);
        runtime.Mode = mode;
        runtime.PauseReason = reason;
        runtime.UpdatedAt = DateTimeOffset.UtcNow;
        await context.SaveChangesAsync(cancellationToken);
    }

    public async Task<bool> TryResumeAsync(string stationId, CancellationToken cancellationToken = default)
    {
        if (await HasOpenBlockingAlarmAsync(stationId, cancellationToken))
        {
            return false;
        }

        var runtime = await GetOrCreateAsync(stationId, cancellationToken);
        runtime.Mode = StationRuntimeModes.Running;
        runtime.PauseReason = null;
        runtime.UpdatedAt = DateTimeOffset.UtcNow;
        await context.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<bool> HasOpenBlockingAlarmAsync(string stationId, CancellationToken cancellationToken = default)
    {
        var open = await context.Alarms.AsNoTracking()
            .Where(alarm => alarm.Station == stationId
                && alarm.Status != "Çözüldü"
                && alarm.Status != "Kapalı")
            .Select(alarm => new { alarm.Title, alarm.Severity })
            .ToListAsync(cancellationToken);

        return open.Any(alarm => IsBlocking(alarm.Title, alarm.Severity));
    }

    internal static bool IsOperatorHoldAlarm(string? title)
    {
        return ContainsAny(
            title,
            "Duruş Bildirimi",
            "Model Değişimi / Setup",
            "Model Değişimi",
            "ARIZA / ACİL");
    }

    internal static bool IsBlocking(string? title, string? severity)
    {
        if (string.Equals(severity, "Kritik", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        return ContainsAny(
            title,
            "Duruş",
            "Setup",
            "Model Değişimi",
            "Acil",
            "Emergency",
            "ARIZA",
            "Yüksek Sıcaklık",
            "Yüksek Titreşim",
            "Düşük RPM");
    }

    private static bool ContainsAny(string? value, params string[] needles)
    {
        if (string.IsNullOrWhiteSpace(value)) return false;
        return needles.Any(needle => value.Contains(needle, StringComparison.OrdinalIgnoreCase));
    }
}

