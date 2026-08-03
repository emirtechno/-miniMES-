using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MiniMesApi.DTOs;
using MiniMesApi.Models;
using MiniMesApi.Security;

namespace MiniMesApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = PolicyNames.UserManage)]
public sealed class UsersController(UserManager<ApplicationUser> userManager) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyCollection<IdentityUserDto>>> GetUsers(
        CancellationToken cancellationToken)
    {
        var users = await userManager.Users
            .AsNoTracking()
            .OrderBy(user => user.UserName)
            .Take(500)
            .ToListAsync(cancellationToken);
        var responses = new List<IdentityUserDto>(users.Count);

        foreach (var user in users)
        {
            responses.Add(await ToDtoAsync(user));
        }

        return Ok(responses);
    }

    [HttpPost]
    public async Task<ActionResult<IdentityUserDto>> CreateUser(CreateIdentityUserDto request)
    {
        if (!AppRoles.All.Contains(request.Role, StringComparer.Ordinal))
        {
            return BadRequest(new ValidationProblemDetails(new Dictionary<string, string[]>
            {
                [nameof(request.Role)] = ["Geçersiz rol."]
            }));
        }

        var user = new ApplicationUser
        {
            UserName = request.Username,
            DisplayName = request.DisplayName,
            IsActive = true
        };
        var createResult = await userManager.CreateAsync(user, request.Password);
        if (!createResult.Succeeded)
        {
            return IdentityValidationProblem(createResult);
        }

        var roleResult = await userManager.AddToRoleAsync(user, request.Role);
        if (!roleResult.Succeeded)
        {
            await userManager.DeleteAsync(user);
            return IdentityValidationProblem(roleResult);
        }

        return CreatedAtAction(nameof(GetUsers), await ToDtoAsync(user));
    }

    [HttpPut("{id}/roles")]
    public async Task<ActionResult<IdentityUserDto>> UpdateRoles(
        string id,
        UpdateIdentityUserRolesDto request)
    {
        var requestedRoles = request.Roles.Distinct(StringComparer.Ordinal).ToArray();
        if (requestedRoles.Any(role => !AppRoles.All.Contains(role, StringComparer.Ordinal)))
        {
            return BadRequest(new ValidationProblemDetails(new Dictionary<string, string[]>
            {
                [nameof(request.Roles)] = ["Bir veya daha fazla rol geçersiz."]
            }));
        }

        var user = await userManager.FindByIdAsync(id);
        if (user is null)
        {
            return NotFound();
        }

        var currentRoles = await userManager.GetRolesAsync(user);
        if (id == userManager.GetUserId(User) && !requestedRoles.Contains(AppRoles.Admin, StringComparer.Ordinal))
        {
            return Conflict(new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "Kendi Admin rolünüzü kaldıramazsınız."
            });
        }
        if (currentRoles.Contains(AppRoles.Admin) &&
            !requestedRoles.Contains(AppRoles.Admin, StringComparer.Ordinal) &&
            await IsLastActiveAdminAsync(user))
        {
            return Conflict(new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "Son aktif Admin kullanıcının rolü kaldırılamaz."
            });
        }

        var removeResult = await userManager.RemoveFromRolesAsync(user, currentRoles.Except(requestedRoles));
        if (!removeResult.Succeeded)
        {
            return IdentityValidationProblem(removeResult);
        }

        var addResult = await userManager.AddToRolesAsync(user, requestedRoles.Except(currentRoles));
        if (!addResult.Succeeded)
        {
            return IdentityValidationProblem(addResult);
        }

        await userManager.UpdateSecurityStampAsync(user);
        return Ok(await ToDtoAsync(user));
    }

    [HttpPut("{id}/status")]
    public async Task<ActionResult<IdentityUserDto>> UpdateStatus(
        string id,
        UpdateIdentityUserStatusDto request)
    {
        if (id == userManager.GetUserId(User) && !request.IsActive)
        {
            return Conflict(new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "Kendi hesabınızı devre dışı bırakamazsınız."
            });
        }

        var user = await userManager.FindByIdAsync(id);
        if (user is null)
        {
            return NotFound();
        }
        if (!request.IsActive && await IsLastActiveAdminAsync(user))
        {
            return Conflict(new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "Son aktif Admin kullanıcısı devre dışı bırakılamaz."
            });
        }

        user.IsActive = request.IsActive;
        var result = await userManager.UpdateAsync(user);
        if (!result.Succeeded)
        {
            return IdentityValidationProblem(result);
        }

        await userManager.UpdateSecurityStampAsync(user);
        return Ok(await ToDtoAsync(user));
    }

    [HttpPost("{id}/reset-password")]
    public async Task<IActionResult> ResetPassword(
        string id,
        ResetIdentityUserPasswordDto request)
    {
        var user = await userManager.FindByIdAsync(id);
        if (user is null)
        {
            return NotFound();
        }

        var token = await userManager.GeneratePasswordResetTokenAsync(user);
        var result = await userManager.ResetPasswordAsync(user, token, request.NewPassword);
        if (!result.Succeeded)
        {
            return IdentityValidationProblem(result);
        }

        return NoContent();
    }

    private async Task<IdentityUserDto> ToDtoAsync(ApplicationUser user)
    {
        var roles = await userManager.GetRolesAsync(user);
        return new IdentityUserDto
        {
            Id = user.Id,
            Username = user.UserName ?? string.Empty,
            DisplayName = user.DisplayName,
            IsActive = user.IsActive,
            Roles = roles.ToArray(),
            Permissions = AppPermissions.ForRoles(roles)
        };
    }

    private ActionResult IdentityValidationProblem(IdentityResult result)
    {
        var errors = result.Errors
            .GroupBy(error => error.Code)
            .ToDictionary(
                group => group.Key,
                group => group.Select(error => error.Description).ToArray());
        return BadRequest(new ValidationProblemDetails(errors));
    }

    private async Task<bool> IsLastActiveAdminAsync(ApplicationUser user)
    {
        if (!await userManager.IsInRoleAsync(user, AppRoles.Admin))
        {
            return false;
        }

        var administrators = await userManager.GetUsersInRoleAsync(AppRoles.Admin);
        return administrators.Count(candidate => candidate.IsActive) <= 1;
    }
}
