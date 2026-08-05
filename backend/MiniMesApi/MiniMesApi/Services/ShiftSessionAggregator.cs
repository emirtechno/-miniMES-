using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using MiniMesApi.DTOs;
using MiniMesApi.Models;

namespace MiniMesApi.Services;

/// <summary>
/// Aggregates MachineMetrics / ScrapLogs for an operator ShiftSession.
/// Prefers ShiftSessionId; falls back to station + StartedAt..end for legacy rows.
/// </summary>
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
        var tagged = await context.MachineMetrics.AsNoTracking()
            .Where(metric => metric.ShiftSessionId == session.Id)
            .ToListAsync(cancellationToken);

        var metrics = tagged.Count > 0
            ? tagged
            : await context.MachineMetrics.AsNoTracking()
                .Where(metric => metric.StationId == session.StationId
                    && metric.RecordedAt >= session.StartedAt
                    && metric.RecordedAt <= end)
                .ToListAsync(cancellationToken);

        var scrapTagged = await context.ScrapLogs.AsNoTracking()
            .Where(log => log.ShiftSessionId == session.Id)
            .Select(log => log.Quantity)
            .ToListAsync(cancellationToken);

        var scrapQty = scrapTagged.Count > 0
            ? scrapTagged.Sum()
            : await context.ScrapLogs.AsNoTracking()
                .Where(log => log.StationId == session.StationId
                    && log.RecordedAt >= session.StartedAt
                    && log.RecordedAt <= end
                    && (log.ShiftSessionId == null || log.ShiftSessionId == session.Id))
                .SumAsync(log => (int?)log.Quantity, cancellationToken) ?? 0;

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
                // fall through to column fields
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
}
