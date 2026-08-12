using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MiniMesApi.Models;

public static class StationRuntimeModes
{
    public const string Running = "Running";
    public const string Paused = "Paused";
    public const string Down = "Down";

    public static readonly string[] All = [Running, Paused, Down];
}

[Table("StationRuntimes")]
public class StationRuntime
{
    [Key]
    [StringLength(80)]
    public string StationId { get; set; } = string.Empty;

    [Required]
    [StringLength(20)]
    public string Mode { get; set; } = StationRuntimeModes.Running;

    [StringLength(200)]
    public string? PauseReason { get; set; }

    /// <summary>
    /// Kalıcı anomali-alarm cooldown kapısı (restart sonrası da yaşar; Redis olmadan çoklu instance).
    /// </summary>
    public DateTimeOffset? NextAnomalyAllowedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
