namespace MiniMesApi.DTOs;

/// <summary>PLC / simülasyon ingest gövdesi — makine telemetri tick'i.</summary>
public sealed class CreateMachineMetricDto
{
    public string StationId { get; set; } = string.Empty;
    public double PlannedProductionSeconds { get; set; } = 300;
    public double DowntimeSeconds { get; set; }
    public string DowntimeReasonCode { get; set; } = string.Empty;
    public string ShiftCode { get; set; } = string.Empty;
    public double IdealCycleTimeSeconds { get; set; } = 2;
    public int ActualProductionCount { get; set; }
    public int GoodProductionCount { get; set; }
    public double? Temperature { get; set; }
    public double? Rpm { get; set; }
    public double? Vibration { get; set; }
    public DateTimeOffset? RecordedAt { get; set; }
}
