using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using MiniMesApi.Models;

namespace MiniMesApi.Tests;

public sealed class MiniMesApiFactory : WebApplicationFactory<Program>
{
    private readonly string _databaseName = $"MiniMesTests-{Guid.NewGuid():N}";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("Jwt:Key", "0123456789abcdef0123456789abcdef");
        builder.UseSetting("Jwt:Issuer", "MiniMesApi");
        builder.UseSetting("Jwt:Audience", "MiniMesUi");
        builder.UseSetting("Jwt:AccessTokenMinutes", "30");
        builder.UseSetting("Cors:AllowedOrigins:0", "http://localhost:5173");
        builder.UseSetting("OeeSimulation:Enabled", "false");
        builder.UseSetting("MachineMetricRetention:Enabled", "false");
        builder.UseSetting("AllowedHosts", "localhost");

        builder.ConfigureServices(services =>
        {
            services.RemoveAll(typeof(DbContextOptions<MesDbContext>));
            services.RemoveAll(typeof(MesDbContext));

            services.AddDbContext<MesDbContext>(options =>
                options.UseInMemoryDatabase(_databaseName));
        });
    }
}
