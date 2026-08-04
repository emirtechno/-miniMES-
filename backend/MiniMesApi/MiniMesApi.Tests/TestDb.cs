using Microsoft.EntityFrameworkCore;
using MiniMesApi.Models;

namespace MiniMesApi.Tests;

internal static class TestDb
{
    public static MesDbContext CreateContext(string? name = null)
    {
        var options = new DbContextOptionsBuilder<MesDbContext>()
            .UseInMemoryDatabase(name ?? $"MiniMes-Unit-{Guid.NewGuid():N}")
            .Options;
        return new MesDbContext(options);
    }
}
