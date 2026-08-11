using System.ComponentModel.DataAnnotations;
using MiniMesApi.Models;

/// <summary>Eski izlenebilirlik döngü logu — tablo düşürüldü; shop-floor MES yolu kullanmaz.</summary>
[Obsolete("Legacy TraceabilityLogs table removed.")]
public class TraceabilityLog
{
    public int Id { get; set; }
    
    public int BatchId { get; set; }

    public int StationId { get; set; }
    public Station? Station { get; set; }

    public int UserId { get; set; }
    public User? User { get; set; }

    public DateTimeOffset EntryTime { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? ExitTime { get; set; }
    
    [Required]
    [StringLength(20)]
    public string Status { get; set; } = "PASS";

    [StringLength(1000)]
    public string? CycleNotes { get; set; }
}