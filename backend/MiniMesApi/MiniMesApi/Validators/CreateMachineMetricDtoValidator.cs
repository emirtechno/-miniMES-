using FluentValidation;
using MiniMesApi.DTOs;
using MiniMesApi.Models;

namespace MiniMesApi.Validators;

public sealed class CreateMachineMetricDtoValidator : AbstractValidator<CreateMachineMetricDto>
{
    public CreateMachineMetricDtoValidator()
    {
        RuleFor(x => x.StationId)
            .NotEmpty()
            .Must(StationCatalog.Contains)
            .WithMessage("Geçersiz istasyon kimliği.");

        RuleFor(x => x.PlannedProductionSeconds)
            .GreaterThan(0);

        RuleFor(x => x.DowntimeSeconds)
            .GreaterThanOrEqualTo(0);

        RuleFor(x => x.IdealCycleTimeSeconds)
            .GreaterThan(0);

        RuleFor(x => x.ActualProductionCount)
            .GreaterThanOrEqualTo(0);

        RuleFor(x => x.GoodProductionCount)
            .GreaterThanOrEqualTo(0)
            .LessThanOrEqualTo(x => x.ActualProductionCount)
            .WithMessage("Sağlam adet gerçekleşen adetten büyük olamaz.");

        RuleFor(x => x.DowntimeReasonCode)
            .Must(code => string.IsNullOrWhiteSpace(code) || DowntimeReasonCatalog.Contains(code))
            .WithMessage("Geçersiz duruş nedeni.");

        RuleFor(x => x.ShiftCode)
            .Must(code => string.IsNullOrWhiteSpace(code) || ShiftCatalog.Contains(code))
            .WithMessage("Geçersiz vardiya kodu.");
    }
}
