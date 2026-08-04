using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace MiniMesApi.Hubs;

[Authorize]
public sealed class MesHub : Hub
{
    public const string Route = "/hubs/mes";

    public static class Events
    {
        public const string AlarmCreated = "alarmCreated";
        public const string AlarmUpdated = "alarmUpdated";
        public const string AlarmDeleted = "alarmDeleted";
        public const string OeeUpdated = "oeeUpdated";
    }

    /// <summary>SignalR group name constants (distinct from Hub.Groups manager).</summary>
    public static class GroupNames
    {
        public const string Plant = "plant";

        public static string Station(string stationId) => $"station:{stationId}";
    }

    public override async Task OnConnectedAsync()
    {
        // Backward compatible: every authenticated client lands in the plant group
        // so publishers no longer need Clients.All.
        await Groups.AddToGroupAsync(Context.ConnectionId, GroupNames.Plant);
        await base.OnConnectedAsync();
    }

    public Task JoinPlant() =>
        Groups.AddToGroupAsync(Context.ConnectionId, GroupNames.Plant);

    public Task JoinStation(string stationId)
    {
        if (string.IsNullOrWhiteSpace(stationId))
        {
            return Task.CompletedTask;
        }

        return Groups.AddToGroupAsync(Context.ConnectionId, GroupNames.Station(stationId.Trim()));
    }

    public Task LeaveStation(string stationId)
    {
        if (string.IsNullOrWhiteSpace(stationId))
        {
            return Task.CompletedTask;
        }

        return Groups.RemoveFromGroupAsync(Context.ConnectionId, GroupNames.Station(stationId.Trim()));
    }
}
