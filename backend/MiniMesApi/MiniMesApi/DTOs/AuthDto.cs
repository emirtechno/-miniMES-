namespace MiniMesApi.DTOs;

public sealed class LoginRequestDto
{
    public string Username { get; init; } = string.Empty;
    public string Password { get; init; } = string.Empty;
}

public sealed class LoginResponseDto
{
    public string AccessToken { get; init; } = string.Empty;
    public DateTime ExpiresAtUtc { get; init; }
    public string Username { get; init; } = string.Empty;
    public string DisplayName { get; init; } = string.Empty;
    public string Role { get; init; } = string.Empty;
    public string Permission { get; init; } = string.Empty;
}

public sealed class DevelopmentUser
{
    public string Username { get; init; } = string.Empty;
    public string Password { get; init; } = string.Empty;
    public string DisplayName { get; init; } = string.Empty;
    public string Role { get; init; } = string.Empty;
    public string Permission { get; init; } = string.Empty;
}
