using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using MiniMesApi.DTOs;
using MiniMesApi.Models;
using MiniMesApi.Options;

namespace MiniMesApi.Security;

public interface IJwtTokenService
{
    Task<LoginResponseDto> CreateAsync(ApplicationUser user);
}

public sealed class JwtTokenService(
    UserManager<ApplicationUser> userManager,
    IOptions<JwtOptions> options,
    TimeProvider timeProvider) : IJwtTokenService
{
    public async Task<LoginResponseDto> CreateAsync(ApplicationUser user)
    {
        var jwt = options.Value;
        var roles = await userManager.GetRolesAsync(user);
        var permissions = AppPermissions.ForRoles(roles);
        var now = timeProvider.GetUtcNow();
        var expiresAt = now.AddMinutes(jwt.AccessTokenMinutes);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new(ClaimTypes.NameIdentifier, user.Id),
            new(ClaimTypes.Name, user.UserName ?? string.Empty),
            new("display_name", user.DisplayName),
            new("security_stamp", user.SecurityStamp ?? string.Empty)
        };
        claims.AddRange(roles.Select(role => new Claim(ClaimTypes.Role, role)));
        claims.AddRange(permissions.Select(permission => new Claim("permission", permission)));

        var credentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Key)),
            SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(
            jwt.Issuer,
            jwt.Audience,
            claims,
            notBefore: now.UtcDateTime,
            expires: expiresAt.UtcDateTime,
            signingCredentials: credentials);

        return new LoginResponseDto
        {
            AccessToken = new JwtSecurityTokenHandler().WriteToken(token),
            ExpiresAtUtc = expiresAt.UtcDateTime,
            UserId = user.Id,
            Username = user.UserName ?? string.Empty,
            DisplayName = user.DisplayName,
            IsActive = user.IsActive,
            Roles = roles.ToArray(),
            Permissions = permissions
        };
    }
}
