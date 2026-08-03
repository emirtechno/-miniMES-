using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MiniMesApi.Models;

[Table("AuditLogs")]
public class AuditLog
{
    [Key]
    public long Id { get; set; }

    [Required]
    [StringLength(80)]
    public string EntityType { get; set; } = string.Empty;

    [Required]
    [StringLength(80)]
    public string EntityId { get; set; } = string.Empty;

    [Required]
    [StringLength(40)]
    public string Action { get; set; } = string.Empty;

    [StringLength(80)]
    public string? ActorUserId { get; set; }

    [StringLength(100)]
    public string? ActorUsername { get; set; }

    public DateTimeOffset OccurredAtUtc { get; set; } = DateTimeOffset.UtcNow;

    [StringLength(1000)]
    public string? Details { get; set; }
}

public static class AuditActions
{
    public const string SoftDelete = "SoftDelete";
    public const string Restore = "Restore";
    public const string HardDelete = "HardDelete";
}

public static class AuditEntityTypes
{
    public const string ProductionRecord = "UretimKayit";
}
