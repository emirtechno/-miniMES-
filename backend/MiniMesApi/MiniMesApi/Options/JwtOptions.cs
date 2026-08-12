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

    // Dev shop-floor oturumları en fazla 480 dk (8s); üretimde tipik 30.
    [Range(5, 480)]
    public int AccessTokenMinutes { get; init; } = 30;
}
