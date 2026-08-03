using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using MiniMesApi.DTOs;
using MiniMesApi.Models;
using MiniMesApi.Security;

namespace MiniMesApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public sealed class AuthController(
    UserManager<ApplicationUser> userManager,
    SignInManager<ApplicationUser> signInManager,
    IPasswordHasher<ApplicationUser> passwordHasher,
    IJwtTokenService tokenService) : ControllerBase
{
    private static readonly ApplicationUser DummyUser = new() { UserName = "dummy", DisplayName = "dummy" };
    private static readonly string DummyPasswordHash =
        new PasswordHasher<ApplicationUser>().HashPassword(DummyUser, "DummyPassword!123");

    [AllowAnonymous]
    [HttpPost("login")]
    [EnableRateLimiting("login")]
    public async Task<ActionResult<LoginResponseDto>> Login([FromBody] LoginRequestDto request)
    {
        var user = await userManager.FindByNameAsync(request.Username);

        if (user is null)
        {
            passwordHasher.VerifyHashedPassword(DummyUser, DummyPasswordHash, request.Password);
            return Unauthorized(CreateUnauthorizedProblem());
        }

        var signInResult = await signInManager.CheckPasswordSignInAsync(
            user,
            request.Password,
            lockoutOnFailure: true);
        if (!signInResult.Succeeded || !user.IsActive)
        {
            return Unauthorized(CreateUnauthorizedProblem());
        }

        return Ok(await tokenService.CreateAsync(user));
    }

    [HttpGet("me")]
    public async Task<ActionResult<CurrentUserDto>> Me()
    {
        var user = await userManager.GetUserAsync(User);
        if (user is null)
        {
            return Unauthorized(CreateUnauthorizedProblem());
        }

        var roles = User.FindAll(System.Security.Claims.ClaimTypes.Role)
            .Select(claim => claim.Value)
            .ToArray();
        var permissions = User.FindAll("permission")
            .Select(claim => claim.Value)
            .ToArray();
        return Ok(new CurrentUserDto
        {
            UserId = user.Id,
            Username = user.UserName ?? string.Empty,
            DisplayName = user.DisplayName,
            IsActive = user.IsActive,
            Roles = roles,
            Permissions = permissions
        });
    }

    [HttpPost("change-password")]
    public async Task<IActionResult> ChangePassword(ChangePasswordDto request)
    {
        var user = await userManager.GetUserAsync(User);
        if (user is null)
        {
            return Unauthorized(CreateUnauthorizedProblem());
        }

        var result = await userManager.ChangePasswordAsync(
            user,
            request.CurrentPassword,
            request.NewPassword);
        if (!result.Succeeded)
        {
            var errors = result.Errors
                .GroupBy(error => error.Code)
                .ToDictionary(
                    group => group.Key,
                    group => group.Select(error => error.Description).ToArray());
            return BadRequest(new ValidationProblemDetails(errors));
        }

        return NoContent();
    }

    private static ProblemDetails CreateUnauthorizedProblem()
    {
        return new ProblemDetails
        {
            Status = StatusCodes.Status401Unauthorized,
            Title = "Kimlik doğrulama başarısız.",
            Detail = "Kullanıcı adı veya parola hatalı."
        };
    }
}
