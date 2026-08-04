using Microsoft.AspNetCore.Identity;
using MiniMesApi.Models;

namespace MiniMesApi.Security;

/// <summary>
/// Seeds Identity roles always; seed users only in Development (or when explicitly enabled).
/// Risk: appsettings.Development.json contains known weak PINs (admin/123) — never load that
/// file / those values into Production. Production ignores Development passwords by default.
/// </summary>
public static class IdentityBootstrapper
{
    public static async Task InitializeAsync(
        IServiceProvider serviceProvider,
        IConfiguration configuration,
        IHostEnvironment environment,
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

        // Development: always bootstrap documented local users + sync weak PINs.
        // Production/Staging: skip unless IdentityBootstrap:Enabled=true (first boot via env vars).
        // Never auto-apply Development known passwords outside Development.
        var bootstrapUsers = environment.IsDevelopment()
            || configuration.GetValue("IdentityBootstrap:Enabled", false);
        if (!bootstrapUsers)
        {
            logger.LogInformation(
                "IdentityBootstrap kullanıcı seed atlandı (ortam={Environment}). " +
                "İlk kurulum için IdentityBootstrap:Enabled=true ve güçlü parolaları ortam değişkeninden verin.",
                environment.EnvironmentName);
            return;
        }

        if (!environment.IsDevelopment() && configuration.GetValue("IdentityBootstrap:Enabled", false))
        {
            logger.LogWarning(
                "IdentityBootstrap:Enabled=true outside Development — ensure passwords come from secrets/env, not committed config.");
        }

        var userManager = serviceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        // Only Development rewrites existing hashes to match config (dev UX).
        var syncPasswords = environment.IsDevelopment();

        await EnsureSeedUserAsync(
            userManager,
            username: configuration["IdentityBootstrap:AdminUsername"],
            password: configuration["IdentityBootstrap:AdminPassword"],
            displayName: configuration["IdentityBootstrap:AdminDisplayName"],
            email: configuration["IdentityBootstrap:AdminEmail"],
            role: AppRoles.Admin,
            syncPassword: syncPasswords,
            logger);

        await EnsureSeedUserAsync(
            userManager,
            username: configuration["IdentityBootstrap:OperatorUsername"],
            password: configuration["IdentityBootstrap:OperatorPassword"],
            displayName: configuration["IdentityBootstrap:OperatorDisplayName"],
            email: configuration["IdentityBootstrap:OperatorEmail"],
            role: AppRoles.Operator,
            syncPassword: syncPasswords,
            logger);
    }

    private static async Task EnsureSeedUserAsync(
        UserManager<ApplicationUser> userManager,
        string? username,
        string? password,
        string? displayName,
        string? email,
        string role,
        bool syncPassword,
        ILogger logger)
    {
        if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(password))
        {
            return;
        }

        var user = await userManager.FindByNameAsync(username);
        if (user is null)
        {
            user = new ApplicationUser
            {
                UserName = username,
                DisplayName = string.IsNullOrWhiteSpace(displayName) ? username : displayName,
                Email = email,
                EmailConfirmed = true,
                IsActive = true
            };

            var createResult = await userManager.CreateAsync(user, password);
            EnsureSucceeded(createResult, $"Bootstrap kullanıcısı '{username}' oluşturulamadı.");
            logger.LogInformation("Bootstrap kullanıcısı oluşturuldu: {Username} ({Role})", username, role);
        }
        else if (syncPassword)
        {
            if (!await userManager.CheckPasswordAsync(user, password))
            {
                var token = await userManager.GeneratePasswordResetTokenAsync(user);
                var resetResult = await userManager.ResetPasswordAsync(user, token, password);
                EnsureSucceeded(resetResult, $"Bootstrap kullanıcısı '{username}' parolası güncellenemedi.");
                logger.LogInformation(
                    "Development: bootstrap kullanıcısı parolası senkronize edildi: {Username}",
                    username);
            }

            if (!user.IsActive)
            {
                user.IsActive = true;
                EnsureSucceeded(await userManager.UpdateAsync(user), $"'{username}' etkinleştirilemedi.");
            }

            await userManager.SetLockoutEndDateAsync(user, null);
            await userManager.ResetAccessFailedCountAsync(user);
        }

        if (!await userManager.IsInRoleAsync(user, role))
        {
            var roleResult = await userManager.AddToRoleAsync(user, role);
            EnsureSucceeded(roleResult, $"Bootstrap kullanıcısına '{role}' rolü atanamadı.");
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
