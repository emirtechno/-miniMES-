using System.ComponentModel.DataAnnotations;
using MiniMesApi.Models;

/// <summary>Legacy traceability cycle log — table dropped; unused by shop-floor MES path.</summary>
[Obsolete("Legacy TraceabilityLogs table removed.")]
public class TraceabilityLog
{
    public int Id { get; set; }
    
    public int BatchId { get; set; }
    public Batch? Batch { get; set; }

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