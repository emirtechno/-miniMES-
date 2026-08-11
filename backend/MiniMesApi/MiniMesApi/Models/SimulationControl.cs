using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MiniMesApi.Models;

/// <summary>
/// OEE fabrika simülasyonu için tekil (singleton) runtime kapısı (Id = 1).
/// Süreç restart'ından sonra da kalır; operatör vardiya oturumlarından bağımsız.
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
