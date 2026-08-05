using Microsoft.EntityFrameworkCore;
using MiniMesApi.Models;
using MiniMesApi.Services;

namespace MiniMesApi.Tests;

public class FactorySimulationControlTests
{
    [Fact]
    public void ShouldRunSimulationTicks_RespectsControlFlag()
    {
        Assert.True(OeeSimulationService.ShouldRunSimulationTicks(controlEnabled: true));
        Assert.False(OeeSimulationService.ShouldRunSimulationTicks(controlEnabled: false));
    }

    [Fact]
    public async Task EnsureSeeded_CreatesSingletonEnabledRow()
    {
        await using var db = CreateDb();
        var service = new FactorySimulationControlService(db);

        await service.EnsureSeededAsync();

        var row = await db.SimulationControls.SingleAsync();
        Assert.Equal(SimulationControl.SingletonId, row.Id);
        Assert.True(row.Enabled);
        Assert.Equal("system", row.UpdatedBy);
    }

    [Fact]
    public async Task SetEnabled_PersistsAndSurvivesReload()
    {
        var dbName = Guid.NewGuid().ToString();
        await using (var db = CreateDb(dbName))
        {
            var service = new FactorySimulationControlService(db);
            await service.EnsureSeededAsync();
            var updated = await service.SetEnabledAsync(false, "admin-test");
            Assert.False(updated.Enabled);
            Assert.Equal("backend", updated.Source);
            Assert.Equal("admin-test", updated.UpdatedBy);
        }

        await using (var db = CreateDb(dbName))
        {
            var service = new FactorySimulationControlService(db);
            Assert.False(await service.IsEnabledAsync());
            var status = await service.GetStatusAsync();
            Assert.False(status.Enabled);
            Assert.Equal("backend", status.Source);
            Assert.Equal("admin-test", status.UpdatedBy);
        }
    }

    [Fact]
    public async Task SetEnabled_CanReEnable()
    {
        await using var db = CreateDb();
        var service = new FactorySimulationControlService(db);
        await service.SetEnabledAsync(false, "ops");
        var enabled = await service.SetEnabledAsync(true, "ops");
        Assert.True(enabled.Enabled);
        Assert.True(await service.IsEnabledAsync());
    }

    private static MesDbContext CreateDb(string? name = null)
    {
        var options = new DbContextOptionsBuilder<MesDbContext>()
            .UseInMemoryDatabase(name ?? Guid.NewGuid().ToString())
            .Options;
        return new MesDbContext(options);
    }
}
