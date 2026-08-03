using System.ComponentModel.DataAnnotations;

public class Station
{
    public int Id { get; set; }

    [Required]
    [StringLength(50)]
    public string StationCode { get; set; } = string.Empty;

    [Required]
    [StringLength(100)]
    public string StationName { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;

    // İlişkiler
    public ICollection<TraceabilityLog>? TraceabilityLogs { get; set; }
}