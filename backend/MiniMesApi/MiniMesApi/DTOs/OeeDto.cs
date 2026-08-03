namespace MiniMesApi.DTOs;

public sealed class OeeMetricDto
{
    public string StationId { get; init; } = string.Empty;
    public double Availability { get; init; }
    public double Performance { get; init; }
    public double Quality { get; init; }
    public double Oee { get; init; }
    public double PlannedProductionSeconds { get; init; }
    public double OperatingTimeSeconds { get; init; }
    public double DowntimeSeconds { get; init; }
    public int TotalProduction { get; init; }
    public int GoodProduction { get; init; }
    public int ScrapProduction { get; init; }
    public DateTimeOffset LastUpdated { get; init; }
}
