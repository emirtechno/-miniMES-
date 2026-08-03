using FluentValidation;
using MiniMesApi.DTOs;
using MiniMesApi.Models;

namespace MiniMesApi.Validators
{
    public class CreateUretimKayitDtoValidator : AbstractValidator<CreateUretimKayitDto>
    {
        public CreateUretimKayitDtoValidator()
        {
            RuleFor(x => x.Urun20liKod)
                .NotEmpty().WithMessage("Ürün barkod alanı boş bırakılamaz.")
                .MinimumLength(3).WithMessage("Ürün barkodu en az 3 karakter olmalıdır.")
                .MaximumLength(20).WithMessage("Ürün barkodu en fazla 20 karakter olabilir.")
                .Matches("^[0-9]+$").WithMessage("Ürün barkodu sadece rakamlardan oluşmalıdır.");

            RuleFor(x => x.Malzeme12liKod)
                .NotEmpty().WithMessage("Malzeme kodu boş bırakılamaz.")
                .MinimumLength(3).WithMessage("Malzeme kodu en az 3 karakter olmalıdır.")
                .MaximumLength(12).WithMessage("Malzeme kodu en fazla 12 karakter olabilir.");

            RuleFor(x => x.IstasyonAdi)
                .NotEmpty().WithMessage("İstasyon adı seçilmelidir.")
                .MaximumLength(50).WithMessage("İstasyon adı 50 karakterden uzun olamaz.")
                .Must(StationCatalog.Contains).WithMessage("Geçersiz istasyon kimliği.");

            RuleFor(x => x.KaliteDurumu)
                .NotEmpty().WithMessage("Kalite durumu belirtilmelidir.")
                .Must(x => x == "OK" || x == "NOK" || x == "REWORK")
                .WithMessage("Geçersiz kalite durumu! Sadece 'OK', 'NOK' veya 'REWORK' değerleri kabul edilir.");
        }
    }
}