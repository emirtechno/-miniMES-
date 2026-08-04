using System.Security.Claims;
using MiniMesApi.Models;
using MiniMesApi.Services;

namespace MiniMesApi.Tests;

/// <summary>O7 — IAuditLogService persists mutation audit rows.</summary>
public sealed class AuditLogServiceTests
{
    [Fact]
    public async Task WriteAsync_persists_actor_and_details()
    {
        await using var db = TestDb.CreateContext();
        var audit = new AuditLogService(db);
        var actor = new ClaimsPrincipal(new ClaimsIdentity(
        [
            new Claim(ClaimTypes.NameIdentifier, "user-1"),
            new Claim(ClaimTypes.Name, "operator")
        ], "test"));

        await audit.WriteAsync(
            AuditEntityTypes.Alarm,
            "42",
            AuditActions.Acknowledge,
            actor,
            "station=Montaj_Hatti_01");

        var row = Assert.Single(db.AuditLogs);
        Assert.Equal(AuditEntityTypes.Alarm, row.EntityType);
        Assert.Equal("42", row.EntityId);
        Assert.Equal(AuditActions.Acknowledge, row.Action);
        Assert.Equal("user-1", row.ActorUserId);
        Assert.Equal("operator", row.ActorUsername);
        Assert.Equal("station=Montaj_Hatti_01", row.Details);
    }
}
