using System.ComponentModel.DataAnnotations;

namespace MiniMesApi.DTOs;

public sealed class CreateScrapDto
{
    [Required]
    [StringLength(80)]
    public string StationId { get; init; } = string.Empty;

    [Range(1, int.MaxValue)]
    public int Quantity { get; init; } = 1;

    [StringLength(80)]
    public string? ReasonCode { get; init; }

    public int? WorkOrderId { get; init; }
    public int? ShiftSessionId { get; init; }
}

public sealed class ScrapLogDto
{
    public int Id { get; init; }
    public string StationId { get; init; } = string.Empty;
    public int Quantity { get; init; }
    public string? ReasonCode { get; init; }
    public int? WorkOrderId { get; init; }
    public int? ShiftSessionId { get; init; }
    public string OperatorUserId { get; init; } = string.Empty;
    public DateTimeOffset RecordedAt { get; init; }
    public int? MachineMetricId { get; init; }
    public MachineMetricDto? Metric { get; init; }
}
