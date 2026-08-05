using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MiniMesApi.Models;

[Table("ShiftSessionEvents")]
public class ShiftSessionEvent
{
    public int Id { get; set; }

    public int ShiftSessionId { get; set; }
    public ShiftSession? ShiftSession { get; set; }

    [Required]
    [StringLength(20)]
    public string FromStatus { get; set; } = string.Empty;

    [Required]
    [StringLength(20)]
    public string ToStatus { get; set; } = string.Empty;

    [StringLength(80)]
    public string? ReasonCode { get; set; }

    public DateTimeOffset OccurredAt { get; set; } = DateTimeOffset.UtcNow;

    [StringLength(120)]
    public string? ActorUserId { get; set; }

    [StringLength(400)]
    public string? Notes { get; set; }
}
