using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using MiniMesApi.DTOs;

namespace MiniMesApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public sealed class AuthController(IConfiguration configuration) : ControllerBase
{
    [AllowAnonymous]
    [HttpPost("login")]
    public ActionResult<ApiResponse<LoginResponseDto>> Login([FromBody] LoginRequestDto request)
    {
        var users = configuration.GetSection("DevelopmentAuth:Users").Get<List<DevelopmentUser>>() ?? [];
        var user = users.FirstOrDefault(candidate =>
            string.Equals(candidate.Username, request.Username, StringComparison.OrdinalIgnoreCase) &&
            candidate.Password == request.Password);

        if (user is null)
        {
            return Unauthorized(ApiResponse<LoginResponseDto>.FailResult("Kullanıcı adı veya parola hatalı."));
        }

        var key = configuration["Jwt:Key"];
        var issuer = configuration["Jwt:Issuer"];
        var audience = configuration["Jwt:Audience"];
        if (string.IsNullOrWhiteSpace(key) || string.IsNullOrWhiteSpace(issuer) || string.IsNullOrWhiteSpace(audience))
        {
            return Problem(statusCode: StatusCodes.Status500InternalServerError, title: "JWT yapılandırması eksik.");
        }

        var expiresAtUtc = DateTime.UtcNow.AddHours(8);
        var claims = new List<Claim>
        {
            new(ClaimTypes.Name, user.Username),
            new(ClaimTypes.Role, user.Role),
            new("display_name", user.DisplayName),
            new("permission", user.Permission)
        };
        var credentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)),
            SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(issuer, audience, claims, expires: expiresAtUtc, signingCredentials: credentials);

        return Ok(ApiResponse<LoginResponseDto>.SuccessResult(new LoginResponseDto
        {
            AccessToken = new JwtSecurityTokenHandler().WriteToken(token),
            ExpiresAtUtc = expiresAtUtc,
            Username = user.Username,
            DisplayName = user.DisplayName,
            Role = user.Role,
            Permission = user.Permission
        }, "Giriş başarılı."));
    }
}
