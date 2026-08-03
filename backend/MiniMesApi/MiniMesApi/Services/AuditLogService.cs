using System.Security.Claims;
using MiniMesApi.Models;

namespace MiniMesApi.Services;

public interface IAuditLogService
{
    Task WriteAsync(
        string entityType,
        string entityId,
        string action,
        ClaimsPrincipal? actor,
        string? details = null,
        CancellationToken cancellationToken = default);
}

public sealed class AuditLogService(MesDbContext dbContext) : IAuditLogService
{
    public async Task WriteAsync(
        string entityType,
        string entityId,
        string action,
        ClaimsPrincipal? actor,
        string? details = null,
        CancellationToken cancellationToken = default)
    {
        var userId = actor?.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? actor?.FindFirstValue("sub");
        var username = actor?.Identity?.Name
            ?? actor?.FindFirstValue(ClaimTypes.Name);

        dbContext.AuditLogs.Add(new AuditLog
        {
            EntityType = entityType,
            EntityId = entityId,
            Action = action,
            ActorUserId = userId,
            ActorUsername = username,
            OccurredAtUtc = DateTimeOffset.UtcNow,
            Details = details
        });

        await dbContext.SaveChangesAsync(cancellationToken);
    }
}
