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
}
