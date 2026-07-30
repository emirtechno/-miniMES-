using FluentValidation;
using MiniMesApi.DTOs;

namespace MiniMesApi.Validators
{
    public class CreateUretimKayitDtoValidator : AbstractValidator<CreateUretimKayitDto>
    {
        public CreateUretimKayitDtoValidator()
        {
            RuleFor(x => x.Urun20liKod)
                .NotEmpty().WithMessage("Ürün 20'li barkod alanı boş bırakılamaz.")
                .Length(20).WithMessage("Ürün 20'li barkodu tam olarak 20 karakter olmalıdır.")
                .Matches("^[0-9]+$").WithMessage("Ürün barkodu sadece rakamlardan oluşmalıdır.");

            RuleFor(x => x.Malzeme12liKod)
                .NotEmpty().WithMessage("12'li malzeme kodu boş bırakılamaz.")
                .Length(12).WithMessage("Malzeme kodu tam olarak 12 karakter olmalıdır.");

            RuleFor(x => x.IstasyonAdi)
                .NotEmpty().WithMessage("İstasyon adı seçilmelidir.")
                .MaximumLength(80).WithMessage("İstasyon adı 80 karakterden uzun olamaz.");

            RuleFor(x => x.KaliteDurumu)
                .NotEmpty().WithMessage("Kalite durumu belirtilmelidir.")
                .Must(x => x == "OK" || x == "NOK" || x == "REWORK")
                .WithMessage("Geçersiz kalite durumu! Sadece 'OK', 'NOK' veya 'REWORK' değerleri kabul edilir.");
        }
    }
}