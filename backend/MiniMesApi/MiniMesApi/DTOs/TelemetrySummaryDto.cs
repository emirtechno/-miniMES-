namespace MiniMesApi.DTOs;

/// <summary>
/// Toplanmış MachineMetrics KPI'ları — panolar için tek kaynak (SSOT).
/// Actual = Σ ActualProductionCount, Good = Σ GoodProductionCount, Nok = Actual − Good.
/// </summary>
public sealed class TelemetrySummaryDto
{
    public string? StationId { get; init; }
    public int Actual { get; init; }
    public int Good { get; init; }
    public int Nok { get; init; }
    public double YieldPercent { get; init; }
    public double DowntimeSeconds { get; init; }
    public int TickCount { get; init; }
    public DateTimeOffset? LastRecordedAt { get; init; }
}
