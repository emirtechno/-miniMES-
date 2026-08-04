using System.ComponentModel.DataAnnotations;

namespace MiniMesApi.DTOs;

public sealed class BatchDto
{
    public int Id { get; init; }
    public string LotNo { get; init; } = string.Empty;
    public string Product { get; init; } = string.Empty;
    public string Station { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public int TargetQuantity { get; init; }
    public int ProducedQuantity { get; init; }
    public double ProgressPercent { get; init; }
    public int? WorkOrderId { get; init; }
    public string? WorkOrderNo { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }
}

public sealed class UpdateBatchProgressDto
{
    [Range(0, int.MaxValue)]
    public int? ProducedQuantity { get; init; }

    [Range(1, int.MaxValue)]
    public int? TargetQuantity { get; init; }
}
