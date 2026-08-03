namespace MiniMesApi.DTOs;

public sealed class MachineMetricDto
{
    public int Id { get; init; }
    public string StationId { get; init; } = string.Empty;
    public double PlannedProductionSeconds { get; init; }
    public double DowntimeSeconds { get; init; }
    public double IdealCycleTimeSeconds { get; init; }
    public int ActualProductionCount { get; init; }
    public int GoodProductionCount { get; init; }
    public DateTimeOffset RecordedAt { get; init; }
}
