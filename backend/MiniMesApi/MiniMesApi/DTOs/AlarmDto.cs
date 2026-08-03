using System.ComponentModel.DataAnnotations;

namespace MiniMesApi.DTOs;

public sealed class CreateAlarmDto
{
    [Required]
    [StringLength(100)]
    public string Title { get; init; } = string.Empty;

    [Required]
    [StringLength(80)]
    public string Station { get; init; } = string.Empty;

    [Required]
    [StringLength(20)]
    public string Severity { get; init; } = string.Empty;

    [StringLength(400)]
    public string Description { get; init; } = string.Empty;
}

public sealed class AlarmDto
{
    public int Id { get; init; }
    public string Title { get; init; } = string.Empty;
    public string Station { get; init; } = string.Empty;
    public string Severity { get; init; } = string.Empty;
    public DateTime Time { get; init; }
    public string Status { get; init; } = string.Empty;
    public string Description { get; init; } = string.Empty;
}
