using System.ComponentModel.DataAnnotations;

namespace MiniMesApi.Options;

public sealed class JwtOptions
{
    public const string SectionName = "Jwt";

    [Required]
    [MinLength(32)]
    public string Key { get; init; } = string.Empty;

    [Required]
    public string Issuer { get; init; } = string.Empty;

    [Required]
    public string Audience { get; init; } = string.Empty;

    [Range(5, 60)]
    public int AccessTokenMinutes { get; init; } = 30;
}
