using System.ComponentModel.DataAnnotations;

namespace MiniMesApi.DTOs;

public sealed class CreateWorkOrderDto
{
    [Required]
    [StringLength(50, MinimumLength = 3)]
    public string OrderNo { get; init; } = string.Empty;

    [Required]
    [StringLength(100, MinimumLength = 3)]
    public string Product { get; init; } = string.Empty;

    [Required]
    [StringLength(80)]
    public string Station { get; init; } = string.Empty;

    [Range(1, int.MaxValue)]
    public int Quantity { get; init; }
}

public sealed class WorkOrderDto
{
    public int Id { get; init; }
    public string OrderNo { get; init; } = string.Empty;
    public string Product { get; init; } = string.Empty;
    public string Station { get; init; } = string.Empty;
    public int Quantity { get; init; }
    public int CompletedQuantity { get; init; }
    public double ProgressPercent { get; init; }
    public string Status { get; init; } = string.Empty;
    public string RowVersion { get; init; } = string.Empty;
}

public sealed class AdvanceWorkOrderDto
{
    [Required]
    public string RowVersion { get; init; } = string.Empty;
}
