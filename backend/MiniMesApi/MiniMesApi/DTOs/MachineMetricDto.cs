namespace MiniMesApi.DTOs;

public sealed class MachineMetricDto
{
    public int Id { get; init; }
    public string StationId { get; init; } = string.Empty;
    public double PlannedProductionSeconds { get; init; }
    public double DowntimeSeconds { get; init; }
    public string DowntimeReasonCode { get; init; } = string.Empty;
    public string DowntimeReason { get; init; } = string.Empty;
    public string ShiftCode { get; init; } = string.Empty;
    public string ShiftName { get; init; } = string.Empty;
    public double IdealCycleTimeSeconds { get; init; }
    public int ActualProductionCount { get; init; }
    public int GoodProductionCount { get; init; }
    public DateTimeOffset RecordedAt { get; init; }
}
