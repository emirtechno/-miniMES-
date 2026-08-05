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
    Task TelemetryTickAsync(MachineMetricDto metric, CancellationToken cancellationToken = default);
    Task ShiftUpdatedAsync(ShiftSessionDto session, CancellationToken cancellationToken = default);
}

public sealed class MesRealtimePublisher(IHubContext<MesHub> hubContext) : IMesRealtimePublisher
{
    public Task AlarmCreatedAsync(AlarmDto alarm, CancellationToken cancellationToken = default) =>
        hubContext.Clients.All.SendAsync(MesHub.Events.AlarmCreated, alarm, cancellationToken);

    public Task AlarmUpdatedAsync(AlarmDto alarm, CancellationToken cancellationToken = default) =>
        hubContext.Clients.All.SendAsync(MesHub.Events.AlarmUpdated, alarm, cancellationToken);

    public Task AlarmDeletedAsync(int alarmId, CancellationToken cancellationToken = default) =>
        hubContext.Clients.All.SendAsync(MesHub.Events.AlarmDeleted, new { id = alarmId }, cancellationToken);

    public Task OeeUpdatedAsync(IReadOnlyCollection<OeeMetricDto> metrics, CancellationToken cancellationToken = default) =>
        hubContext.Clients.All.SendAsync(MesHub.Events.OeeUpdated, metrics, cancellationToken);

    public Task TelemetryTickAsync(MachineMetricDto metric, CancellationToken cancellationToken = default) =>
        hubContext.Clients.All.SendAsync(MesHub.Events.TelemetryTick, metric, cancellationToken);

    public Task ShiftUpdatedAsync(ShiftSessionDto session, CancellationToken cancellationToken = default) =>
        hubContext.Clients.All.SendAsync(MesHub.Events.ShiftUpdated, session, cancellationToken);
}
