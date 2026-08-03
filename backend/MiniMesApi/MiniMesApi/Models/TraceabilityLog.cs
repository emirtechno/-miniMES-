using System.ComponentModel.DataAnnotations;
using MiniMesApi.Models;

public class TraceabilityLog
{
    public int Id { get; set; }
    
    public int BatchId { get; set; }
    public Batch? Batch { get; set; }

    public int StationId { get; set; }
    public Station? Station { get; set; }

    public int UserId { get; set; }
    public User? User { get; set; }

    public DateTime EntryTime { get; set; } = DateTime.Now;
    public DateTime? ExitTime { get; set; }
    
    [Required]
    [StringLength(20)]
    public string Status { get; set; } = "PASS";

    [StringLength(1000)]
    public string? CycleNotes { get; set; }
}