public class Station
{
    public int Id { get; set; }
    public string StationCode { get; set; } = string.Empty; // Örn: ST-MONTAJ-01
    public string StationName { get; set; } = string.Empty; // Örn: Montaj Hattı 1
    public bool IsActive { get; set; } = true;

    // İlişkiler
    public ICollection<TraceabilityLog>? TraceabilityLogs { get; set; }
}