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
    /// Persisted anomaly-alarm cooldown gate (survives restart; multi-instance without Redis).
    /// </summary>
    public DateTimeOffset? NextAnomalyAllowedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
