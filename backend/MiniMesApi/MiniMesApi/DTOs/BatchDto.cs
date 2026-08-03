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
    public DateTimeOffset UpdatedAt { get; init; }
}

public sealed class UpdateBatchProgressDto : IValidatableObject
{
    [Range(0, int.MaxValue)]
    public int? ProducedQuantity { get; init; }

    [Range(1, int.MaxValue)]
    public int? TargetQuantity { get; init; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (ProducedQuantity is null && TargetQuantity is null)
        {
            yield return new ValidationResult(
                "En az bir alan (producedQuantity veya targetQuantity) gönderilmelidir.",
                [nameof(ProducedQuantity), nameof(TargetQuantity)]);
        }

        if (ProducedQuantity is int produced && TargetQuantity is int target && produced > target)
        {
            yield return new ValidationResult(
                "Üretilen miktar hedef miktarı aşamaz.",
                [nameof(ProducedQuantity), nameof(TargetQuantity)]);
        }
    }
}
