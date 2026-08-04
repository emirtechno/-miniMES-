using FluentValidation;
using MiniMesApi.DTOs;
using MiniMesApi.Models;

namespace MiniMesApi.Validators;

public sealed class StartFactorySimulationRequestValidator : AbstractValidator<StartFactorySimulationRequest>
{
    public StartFactorySimulationRequestValidator()
    {
        RuleForEach(x => x.StationIds)
            .Must(StationCatalog.Contains)
            .When(x => x.StationIds is { Length: > 0 })
            .WithMessage("Geçersiz istasyon kimliği.");
    }
}
