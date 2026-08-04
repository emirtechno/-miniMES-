using FluentValidation;
using MiniMesApi.DTOs;
using MiniMesApi.Models;

namespace MiniMesApi.Validators;

public sealed class CreateAlarmDtoValidator : AbstractValidator<CreateAlarmDto>
{
    public static readonly string[] AllowedSeverities = ["Uyarı", "Düşük", "Yüksek", "Kritik"];

    public CreateAlarmDtoValidator()
    {
        RuleFor(x => x.Title)
            .NotEmpty()
            .MinimumLength(3)
            .MaximumLength(100);

        RuleFor(x => x.Station)
            .NotEmpty()
            .Must(StationCatalog.Contains)
            .WithMessage("Geçersiz istasyon kimliği.");

        RuleFor(x => x.Severity)
            .NotEmpty()
            .Must(severity => AllowedSeverities.Contains(severity, StringComparer.Ordinal))
            .WithMessage("Geçersiz alarm şiddeti. İzin verilen: Uyarı, Düşük, Yüksek, Kritik.");

        RuleFor(x => x.Description)
            .MaximumLength(400);
    }
}
