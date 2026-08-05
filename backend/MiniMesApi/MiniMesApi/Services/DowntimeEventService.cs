using Microsoft.EntityFrameworkCore;
using MiniMesApi.Models;

namespace MiniMesApi.Services;

public interface IDowntimeEventService
{
    Task<DowntimeEvent> OpenAsync(
        string stationId,
        string reasonCode,
        string? reasonName,
        bool isPlanned,
        bool isEmergency,
        string source,
        int? shiftSessionId,
        int? alarmId,
        CancellationToken cancellationToken = default);

    Task<int> CloseOpenForSessionAsync(int shiftSessionId, DateTimeOffset endedAt, CancellationToken cancellationToken = default);

    Task<int> CloseOpenForAlarmAsync(int alarmId, DateTimeOffset endedAt, CancellationToken cancellationToken = default);

    Task<int> CloseOpenForAlarmsAsync(IEnumerable<int> alarmIds, DateTimeOffset endedAt, CancellationToken cancellationToken = default);
}

public sealed class DowntimeEventService(MesDbContext context) : IDowntimeEventService
{
    public async Task<DowntimeEvent> OpenAsync(
        string stationId,
        string reasonCode,
        string? reasonName,
        bool isPlanned,
        bool isEmergency,
        string source,
        int? shiftSessionId,
        int? alarmId,
        CancellationToken cancellationToken = default)
    {
        var row = new DowntimeEvent
        {
            StationId = stationId,
            ReasonCode = reasonCode,
            ReasonName = reasonName,
            IsPlanned = isPlanned,
            IsEmergency = isEmergency,
            Source = source,
            ShiftSessionId = shiftSessionId,
            AlarmId = alarmId,
            StartedAt = DateTimeOffset.UtcNow
        };
        context.DowntimeEvents.Add(row);
        await context.SaveChangesAsync(cancellationToken);
        return row;
    }

    public async Task<int> CloseOpenForSessionAsync(
        int shiftSessionId,
        DateTimeOffset endedAt,
        CancellationToken cancellationToken = default)
    {
        var open = await context.DowntimeEvents
            .Where(item => item.ShiftSessionId == shiftSessionId && item.EndedAt == null)
            .ToListAsync(cancellationToken);

        var closed = CloseRows(open, endedAt);
        if (closed > 0)
        {
            await context.SaveChangesAsync(cancellationToken);
        }

        return closed;
    }

    public async Task<int> CloseOpenForAlarmAsync(
        int alarmId,
        DateTimeOffset endedAt,
        CancellationToken cancellationToken = default)
    {
        var open = await context.DowntimeEvents
            .Where(item => item.AlarmId == alarmId && item.EndedAt == null)
            .ToListAsync(cancellationToken);

        var closed = CloseRows(open, endedAt);
        if (closed > 0)
        {
            await context.SaveChangesAsync(cancellationToken);
        }

        return closed;
    }

    public async Task<int> CloseOpenForAlarmsAsync(
        IEnumerable<int> alarmIds,
        DateTimeOffset endedAt,
        CancellationToken cancellationToken = default)
    {
        var ids = alarmIds.Distinct().ToArray();
        if (ids.Length == 0) return 0;

        var open = await context.DowntimeEvents
            .Where(item => item.AlarmId != null && ids.Contains(item.AlarmId.Value) && item.EndedAt == null)
            .ToListAsync(cancellationToken);

        var closed = CloseRows(open, endedAt);
        if (closed > 0)
        {
            await context.SaveChangesAsync(cancellationToken);
        }

        return closed;
    }

    private static int CloseRows(IReadOnlyList<DowntimeEvent> open, DateTimeOffset endedAt)
    {
        foreach (var item in open)
        {
            item.EndedAt = endedAt;
            var seconds = (endedAt - item.StartedAt).TotalSeconds;
            item.DurationSeconds = (int)Math.Max(0, Math.Round(seconds));
        }

        return open.Count;
    }
}
