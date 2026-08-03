using System.ComponentModel.DataAnnotations;

namespace MiniMesApi.DTOs;

public sealed class CreateWorkOrderDto
{
    [Required]
    [StringLength(50)]
    public string OrderNo { get; init; } = string.Empty;

    [Required]
    [StringLength(100)]
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
    public string Status { get; init; } = string.Empty;
}
