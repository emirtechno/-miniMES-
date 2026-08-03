using System.ComponentModel.DataAnnotations;

namespace MiniMesApi.DTOs;

public sealed class IdentityUserDto
{
    public string Id { get; init; } = string.Empty;
    public string Username { get; init; } = string.Empty;
    public string DisplayName { get; init; } = string.Empty;
    public bool IsActive { get; init; }
    public IReadOnlyCollection<string> Roles { get; init; } = [];
    public IReadOnlyCollection<string> Permissions { get; init; } = [];
}

public sealed class CreateIdentityUserDto
{
    [Required]
    [StringLength(50, MinimumLength = 3)]
    public string Username { get; init; } = string.Empty;

    [Required]
    [StringLength(100, MinimumLength = 3)]
    public string DisplayName { get; init; } = string.Empty;

    [Required]
    [StringLength(128, MinimumLength = 6)]
    public string Password { get; init; } = string.Empty;

    [Required]
    public string Role { get; init; } = string.Empty;
}

public sealed class UpdateIdentityUserRolesDto
{
    [Required]
    [MinLength(1)]
    public IReadOnlyCollection<string> Roles { get; init; } = [];
}

public sealed class UpdateIdentityUserStatusDto
{
    public bool IsActive { get; init; }
}

public sealed class ResetIdentityUserPasswordDto
{
    [Required]
    [StringLength(128, MinimumLength = 6)]
    public string NewPassword { get; init; } = string.Empty;
}
