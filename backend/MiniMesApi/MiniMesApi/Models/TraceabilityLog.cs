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
    
    public string Status { get; set; } = "PASS"; // PASS, FAIL, REWORK
    public string? CycleNotes { get; set; } // Varsa test/hata notu
}