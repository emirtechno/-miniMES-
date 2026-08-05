using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Hosting;
using MiniMesApi.Models;

namespace MiniMesApi.Security;

public static class IdentityBootstrapper
{
    public static async Task InitializeAsync(
        IServiceProvider serviceProvider,
        IConfiguration configuration,
        ILogger logger)
    {
        var roleManager = serviceProvider.GetRequiredService<RoleManager<IdentityRole>>();
        foreach (var roleName in AppRoles.All)
        {
            if (!await roleManager.RoleExistsAsync(roleName))
            {
                var result = await roleManager.CreateAsync(new IdentityRole(roleName));
                EnsureSucceeded(result, $"'{roleName}' rolü oluşturulamadı.");
            }
        }

        var username = configuration["IdentityBootstrap:AdminUsername"];
        var password = configuration["IdentityBootstrap:AdminPassword"];
        if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(password))
        {
            var environment = serviceProvider.GetRequiredService<IHostEnvironment>();
            if (environment.IsDevelopment())
            {
                throw new InvalidOperationException(
                    "Development requires IdentityBootstrap:AdminUsername and IdentityBootstrap:AdminPassword. " +
                    "Copy appsettings.Development.json.example → appsettings.Development.json (or set env vars) " +
                    "and provide Jwt:Key (≥32 chars). See AGENTS.md / backend README.");
            }

            logger.LogInformation("Identity bootstrap yöneticisi yapılandırılmadı.");
            return;
        }

        var userManager = serviceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var user = await userManager.FindByNameAsync(username);
        if (user is null)
        {
            user = new ApplicationUser
            {
                UserName = username,
                DisplayName = configuration["IdentityBootstrap:AdminDisplayName"] ?? username,
                Email = configuration["IdentityBootstrap:AdminEmail"],
                EmailConfirmed = true
            };

            var createResult = await userManager.CreateAsync(user, password);
            EnsureSucceeded(createResult, "Bootstrap yöneticisi oluşturulamadı.");
        }

        if (!await userManager.IsInRoleAsync(user, AppRoles.Admin))
        {
            var roleResult = await userManager.AddToRoleAsync(user, AppRoles.Admin);
            EnsureSucceeded(roleResult, "Bootstrap yöneticisine Admin rolü atanamadı.");
        }
    }

    private static void EnsureSucceeded(IdentityResult result, string message)
    {
        if (!result.Succeeded)
        {
            throw new InvalidOperationException(
                $"{message} {string.Join(" ", result.Errors.Select(error => error.Description))}");
        }
    }
}
