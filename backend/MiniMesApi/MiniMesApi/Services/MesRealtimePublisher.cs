using Microsoft.AspNetCore.SignalR;
using MiniMesApi.DTOs;
using MiniMesApi.Hubs;

namespace MiniMesApi.Services;

public interface IMesRealtimePublisher
{
    Task AlarmCreatedAsync(AlarmDto alarm, CancellationToken cancellationToken = default);
    Task AlarmUpdatedAsync(AlarmDto alarm, CancellationToken cancellationToken = default);
    Task AlarmDeletedAsync(int alarmId, CancellationToken cancellationToken = default);
    Task OeeUpdatedAsync(IReadOnlyCollection<OeeMetricDto> metrics, CancellationToken cancellationToken = default);
}

public sealed class MesRealtimePublisher(IHubContext<MesHub> hubContext) : IMesRealtimePublisher
{
    public async Task AlarmCreatedAsync(AlarmDto alarm, CancellationToken cancellationToken = default)
    {
        await hubContext.Clients.Group(MesHub.GroupNames.Plant)
            .SendAsync(MesHub.Events.AlarmCreated, alarm, cancellationToken);
        await SendToStationAsync(alarm.Station, MesHub.Events.AlarmCreated, alarm, cancellationToken);
    }

    public async Task AlarmUpdatedAsync(AlarmDto alarm, CancellationToken cancellationToken = default)
    {
        await hubContext.Clients.Group(MesHub.GroupNames.Plant)
            .SendAsync(MesHub.Events.AlarmUpdated, alarm, cancellationToken);
        await SendToStationAsync(alarm.Station, MesHub.Events.AlarmUpdated, alarm, cancellationToken);
    }

    public Task AlarmDeletedAsync(int alarmId, CancellationToken cancellationToken = default) =>
        hubContext.Clients.Group(MesHub.GroupNames.Plant)
            .SendAsync(MesHub.Events.AlarmDeleted, new { id = alarmId }, cancellationToken);

    public async Task OeeUpdatedAsync(IReadOnlyCollection<OeeMetricDto> metrics, CancellationToken cancellationToken = default)
    {
        await hubContext.Clients.Group(MesHub.GroupNames.Plant)
            .SendAsync(MesHub.Events.OeeUpdated, metrics, cancellationToken);

        foreach (var stationId in metrics
                     .Select(metric => metric.StationId)
                     .Where(id => !string.IsNullOrWhiteSpace(id))
                     .Distinct(StringComparer.Ordinal))
        {
            var stationMetrics = metrics
                .Where(metric => string.Equals(metric.StationId, stationId, StringComparison.Ordinal))
                .ToArray();
            await hubContext.Clients.Group(MesHub.GroupNames.Station(stationId))
                .SendAsync(MesHub.Events.OeeUpdated, stationMetrics, cancellationToken);
        }
    }

    private Task SendToStationAsync(
        string? stationId,
        string eventName,
        object payload,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(stationId))
        {
            return Task.CompletedTask;
        }

        return hubContext.Clients.Group(MesHub.GroupNames.Station(stationId))
            .SendAsync(eventName, payload, cancellationToken);
    }
}
