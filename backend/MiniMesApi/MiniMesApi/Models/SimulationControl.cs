using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MiniMesApi.Models;

/// <summary>
/// Singleton runtime gate for the OEE factory simulation (Id = 1).
/// Survives process restart; independent of operator shift sessions.
/// </summary>
[Table("SimulationControls")]
public class SimulationControl
{
    public const int SingletonId = 1;

    [Key]
    public int Id { get; set; } = SingletonId;

    public bool Enabled { get; set; } = true;

    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    [StringLength(120)]
    public string? UpdatedBy { get; set; }
}
