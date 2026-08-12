using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using MiniMesApi.DTOs;
using MiniMesApi.Models;

namespace MiniMesApi.Services;

// NEDEN: Operatör ShiftSession KPI'ları (adet, fire, downtime, OEE) MachineMetrics + ScrapLogs'tan üretilir.
// ShiftSessionId tercih edilir; eski satırlar için istasyon + StartedAt..end zaman aralığına düşer.
// NASIL: LoadMetrics/LoadScrap → OeeCalculator.CalculateFromWindow → ShiftSessionSummaryDto / board satırı.
public static class ShiftSessionAggregator
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public static async Task<ShiftSessionSummaryDto> BuildAsync(
        MesDbContext context,
        ShiftSession session,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(context);
        ArgumentNullException.ThrowIfNull(session);

        var end = session.EndedAt ?? DateTimeOffset.UtcNow;
        var metrics = await LoadMetricsAsync(context, session, end, cancellationToken);
        var scrapQty = await LoadScrapQuantityAsync(context, session, end, cancellationToken);
        var oee = OeeCalculator.CalculateFromWindow(metrics, session.StationId, session.ShiftCode);
        var mins = Math.Max(0, (int)Math.Round((end - session.StartedAt).TotalMinutes));

        return new ShiftSessionSummaryDto
        {
            DurationMinutes = mins,
            ActualCount = oee.TotalProduction,
            GoodCount = oee.GoodProduction,
            NokCount = oee.ScrapProduction,
            ScrapLogQuantity = scrapQty,
            DowntimeSeconds = oee.DowntimeSeconds,
            OeePercent = metrics.Count == 0 ? null : oee.Oee
        };
    }

    // NEDEN: Oturum kapsamlı OEE (A/P/Q + sayılar). Metrik yoksa null — UI “henüz veri yok” gösterebilir.
    public static async Task<OeeMetricDto?> BuildOeeAsync(
        MesDbContext context,
        ShiftSession session,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(context);
        ArgumentNullException.ThrowIfNull(session);

        var end = session.EndedAt ?? DateTimeOffset.UtcNow;
        var metrics = await LoadMetricsAsync(context, session, end, cancellationToken);
        if (metrics.Count == 0) return null;

        return OeeCalculator.CalculateFromWindow(metrics, session.StationId, session.ShiftCode);
    }

    // NEDEN: Fabrika geneli Andon board — bitmemiş oturumlar, istasyon başına en son StartedAt kazanır.
    // NASIL: Status != Ended → GroupBy StationId → her oturum için BuildOeeAsync.
    public static async Task<IReadOnlyList<ShiftSessionBoardItemDto>> BuildBoardAsync(
        MesDbContext context,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(context);

        var openSessions = await context.ShiftSessions.AsNoTracking()
            .Where(session => session.Status != ShiftSessionStatuses.Ended)
            .OrderByDescending(session => session.StartedAt)
            .ThenByDescending(session => session.Id)
            .ToListAsync(cancellationToken);

        var latestPerStation = openSessions
            .GroupBy(session => session.StationId, StringComparer.OrdinalIgnoreCase)
            .Select(group => group.First())
            .OrderBy(session => session.StationId, StringComparer.OrdinalIgnoreCase)
            .ToList();

        var board = new List<ShiftSessionBoardItemDto>(latestPerStation.Count);
        foreach (var session in latestPerStation)
        {
            var oee = await BuildOeeAsync(context, session, cancellationToken);
            board.Add(new ShiftSessionBoardItemDto
            {
                SessionId = session.Id,
                StationId = session.StationId,
                ShiftCode = session.ShiftCode,
                ShiftName = ShiftCatalog.DisplayName(session.ShiftCode),
                OperatorName = session.OperatorName,
                SecondaryOperatorName = session.SecondaryOperatorName,
                Status = session.Status,
                StartedAt = session.StartedAt,
                Oee = oee
            });
        }

        return board;
    }

    // NEDEN: Vardiya kapanınca özet kolonlara + SummaryJson'a yazılır (sonradan metrik silinse bile KPI kalır).
    public static void ApplyPersistedSummary(ShiftSession session, ShiftSessionSummaryDto summary)
    {
        ArgumentNullException.ThrowIfNull(session);
        ArgumentNullException.ThrowIfNull(summary);

        session.GoodCount = summary.GoodCount;
        session.NokCount = summary.NokCount;
        session.ScrapEntered = summary.ScrapLogQuantity;
        session.DowntimeSeconds = summary.DowntimeSeconds;
        session.OeePercent = summary.OeePercent;
        session.SummaryJson = JsonSerializer.Serialize(new
        {
            summary.DurationMinutes,
            summary.ActualCount,
            summary.GoodCount,
            summary.NokCount,
            summary.ScrapLogQuantity,
            summary.DowntimeSeconds,
            summary.OeePercent
        }, JsonOptions);
    }

    // NEDEN: Kapalı oturumda önce SummaryJson, yoksa kolon alanlarından DTO üret.
    public static ShiftSessionSummaryDto? FromPersisted(ShiftSession session)
    {
        ArgumentNullException.ThrowIfNull(session);
        if (session.GoodCount is null
            && session.NokCount is null
            && session.ScrapEntered is null
            && session.DowntimeSeconds is null
            && session.OeePercent is null
            && string.IsNullOrWhiteSpace(session.SummaryJson))
        {
            return null;
        }

        var end = session.EndedAt ?? DateTimeOffset.UtcNow;
        var mins = Math.Max(0, (int)Math.Round((end - session.StartedAt).TotalMinutes));
        var good = session.GoodCount ?? 0;
        var nok = session.NokCount ?? 0;

        if (!string.IsNullOrWhiteSpace(session.SummaryJson))
        {
            try
            {
                using var doc = JsonDocument.Parse(session.SummaryJson);
                var root = doc.RootElement;
                return new ShiftSessionSummaryDto
                {
                    DurationMinutes = root.TryGetProperty("durationMinutes", out var d) && d.TryGetInt32(out var dm) ? dm : mins,
                    ActualCount = root.TryGetProperty("actualCount", out var a) && a.TryGetInt32(out var ac) ? ac : good + nok,
                    GoodCount = root.TryGetProperty("goodCount", out var g) && g.TryGetInt32(out var gc) ? gc : good,
                    NokCount = root.TryGetProperty("nokCount", out var n) && n.TryGetInt32(out var nc) ? nc : nok,
                    ScrapLogQuantity = root.TryGetProperty("scrapLogQuantity", out var s) && s.TryGetInt32(out var sq)
                        ? sq
                        : session.ScrapEntered ?? 0,
                    DowntimeSeconds = root.TryGetProperty("downtimeSeconds", out var dt) && dt.TryGetDouble(out var dts)
                        ? dts
                        : session.DowntimeSeconds ?? 0,
                    OeePercent = root.TryGetProperty("oeePercent", out var o) && o.ValueKind != JsonValueKind.Null && o.TryGetDouble(out var op)
                        ? op
                        : session.OeePercent
                };
            }
            catch (JsonException)
            {
                // JSON bozuksa kolon alanlarına düş
            }
        }

        return new ShiftSessionSummaryDto
        {
            DurationMinutes = mins,
            ActualCount = good + nok,
            GoodCount = good,
            NokCount = nok,
            ScrapLogQuantity = session.ScrapEntered ?? 0,
            DowntimeSeconds = session.DowntimeSeconds ?? 0,
            OeePercent = session.OeePercent
        };
    }

    // NEDEN: Önce ShiftSessionId ile etiketli metrikler; yoksa legacy zaman aralığı (eski satırlar).
    private static async Task<List<MachineMetric>> LoadMetricsAsync(
        MesDbContext context,
        ShiftSession session,
        DateTimeOffset end,
        CancellationToken cancellationToken)
    {
        var tagged = await context.MachineMetrics.AsNoTracking()
            .Where(metric => metric.ShiftSessionId == session.Id)
            .ToListAsync(cancellationToken);

        if (tagged.Count > 0) return tagged;

        return await context.MachineMetrics.AsNoTracking()
            .Where(metric => metric.StationId == session.StationId
                && metric.RecordedAt >= session.StartedAt
                && metric.RecordedAt <= end)
            .ToListAsync(cancellationToken);
    }

    // NEDEN: Operatörün girdiği ScrapLog miktarı oturum KPI'sında ayrı tutulur (OEE scrap'inden farklı kaynak).
    private static async Task<int> LoadScrapQuantityAsync(
        MesDbContext context,
        ShiftSession session,
        DateTimeOffset end,
        CancellationToken cancellationToken)
    {
        var scrapTagged = await context.ScrapLogs.AsNoTracking()
            .Where(log => log.ShiftSessionId == session.Id)
            .Select(log => log.Quantity)
            .ToListAsync(cancellationToken);

        if (scrapTagged.Count > 0) return scrapTagged.Sum();

        return await context.ScrapLogs.AsNoTracking()
            .Where(log => log.StationId == session.StationId
                && log.RecordedAt >= session.StartedAt
                && log.RecordedAt <= end
                && (log.ShiftSessionId == null || log.ShiftSessionId == session.Id))
            .SumAsync(log => (int?)log.Quantity, cancellationToken) ?? 0;
    }
}
