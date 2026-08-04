using FluentValidation;
using MiniMesApi.DTOs;
using MiniMesApi.Models;

namespace MiniMesApi.Validators;

public sealed class CreateWorkOrderDtoValidator : AbstractValidator<CreateWorkOrderDto>
{
    public CreateWorkOrderDtoValidator()
    {
        RuleFor(x => x.OrderNo)
            .NotEmpty()
            .MinimumLength(3)
            .MaximumLength(50);

        RuleFor(x => x.Product)
            .NotEmpty()
            .MinimumLength(3)
            .MaximumLength(100);

        RuleFor(x => x.Station)
            .NotEmpty()
            .Must(StationCatalog.Contains)
            .WithMessage("Geçersiz istasyon kimliği.");

        RuleFor(x => x.Quantity)
            .GreaterThan(0);
    }
}
