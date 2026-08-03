using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MiniMesApi.DTOs;
using MiniMesApi.Infrastructure;
using MiniMesApi.Models;
using MiniMesApi.Security;

namespace MiniMesApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = PolicyNames.UserManage)]
public sealed class UsersController(UserManager<ApplicationUser> userManager) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<CursorPage<IdentityUserDto>>> GetUsers(
        [FromQuery] int limit = 50,
        [FromQuery] string? cursor = null,
        CancellationToken cancellationToken = default)
    {
        limit = Math.Clamp(limit, 1, 200);
        if (!CursorCodec.TryDecodeString(cursor, out var cursorId))
        {
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Geçersiz sayfalama imleci.");
        }

        var query = userManager.Users.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(cursor))
        {
            query = query.Where(user => user.Id.CompareTo(cursorId) > 0);
        }

        var users = await query
            .AsNoTracking()
            .OrderBy(user => user.Id)
            .Take(limit + 1)
            .ToListAsync(cancellationToken);
        var pageUsers = users.Take(limit).ToArray();
        var roleLookup = new Dictionary<string, List<string>>(StringComparer.Ordinal);
        foreach (var roleName in AppRoles.All)
        {
            var inRole = await userManager.GetUsersInRoleAsync(roleName);
            foreach (var member in inRole)
            {
                if (!roleLookup.TryGetValue(member.Id, out var list))
                {
                    list = [];
                    roleLookup[member.Id] = list;
                }

                list.Add(roleName);
            }
        }

        var responses = pageUsers.Select(user =>
        {
            var roles = roleLookup.TryGetValue(user.Id, out var found)
                ? found.ToArray()
                : [];
            return new IdentityUserDto
            {
                Id = user.Id,
                Username = user.UserName ?? string.Empty,
                DisplayName = user.DisplayName,
                IsActive = user.IsActive,
                Roles = roles,
                Permissions = AppPermissions.ForRoles(roles)
            };
        }).ToList();

        return Ok(new CursorPage<IdentityUserDto>
        {
            Items = responses,
            NextCursor = users.Count > limit && pageUsers.Length > 0
                ? CursorCodec.EncodeString(pageUsers[^1].Id)
                : null
        });
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
