using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using FluentValidation;
using MiniMesApi.Models;
using MiniMesApi.DTOs;
using MiniMesApi.Security;

namespace MiniMesApi.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Microsoft.AspNetCore.Authorization.Authorize]
    public class UretimController : ControllerBase
    {
        private readonly MesDbContext _context;
        private readonly IValidator<CreateUretimKayitDto> _validator;

        public UretimController(MesDbContext context, IValidator<CreateUretimKayitDto> validator)
        {
            _context = context;
            _validator = validator;
        }

        // 1. Tüm Aktif Üretim Kayıtlarını DTO olarak Getir (GET: api/Uretim)
        [HttpGet]
        public async Task<IActionResult> GetUretimler(
            [FromQuery] int limit = 100,
            CancellationToken cancellationToken = default)
        {
            limit = Math.Clamp(limit, 1, 500);

            var uretimler = await _context.UretimKayitlari
                .Where(x => !x.IsDeleted)
                .AsNoTracking()
                .OrderByDescending(x => x.UretimTarihi)
                .Take(limit)
                .Select(x => new UretimKayitResponseDto
                {
                    ID = x.ID,
                    Urun20liKod = x.Urun20liKod,
                    Malzeme12liKod = x.Malzeme12liKod,
                    IstasyonAdi = x.IstasyonAdi,
                    KaliteDurumu = x.KaliteDurumu,
                    UretimTarihi = x.UretimTarihi
                })
                .ToListAsync(cancellationToken);

            return Ok(uretimler);
        }

        // 2. ID'ye Göre Tek Kayıt Getir (GET: api/Uretim/5)
        [HttpGet("{id}")]
        public async Task<IActionResult> GetUretimById(int id)
        {
            var kayit = await _context.UretimKayitlari
                .Where(x => !x.IsDeleted && x.ID == id)
                .AsNoTracking()
                .Select(x => new UretimKayitResponseDto
                {
                    ID = x.ID,
                    Urun20liKod = x.Urun20liKod,
                    Malzeme12liKod = x.Malzeme12liKod,
                    IstasyonAdi = x.IstasyonAdi,
                    KaliteDurumu = x.KaliteDurumu,
                    UretimTarihi = x.UretimTarihi
                })
                .FirstOrDefaultAsync();

            if (kayit == null)
            {
                return Problem(statusCode: StatusCodes.Status404NotFound, title: $"{id} ID'li ürün kaydı bulunamadı.");
            }

            return Ok(kayit);
        }

        // 3. İstasyon veya Kalite Durumuna Göre Filtrele (GET: api/Uretim/filtre)
        [HttpGet("filtre")]
        public async Task<IActionResult> Filtrele(
            [FromQuery] string? istasyon,
            [FromQuery] string? kaliteDurumu,
            [FromQuery] int limit = 100,
            CancellationToken cancellationToken = default)
        {
            limit = Math.Clamp(limit, 1, 500);
            var query = _context.UretimKayitlari.Where(x => !x.IsDeleted).AsQueryable();

            if (!string.IsNullOrEmpty(istasyon))
            {
                query = query.Where(x => x.IstasyonAdi.Contains(istasyon));
            }

            if (!string.IsNullOrEmpty(kaliteDurumu))
            {
                query = query.Where(x => x.KaliteDurumu == kaliteDurumu);
            }

            var sonuc = await query
                .AsNoTracking()
                .OrderByDescending(x => x.UretimTarihi)
                .Take(limit)
                .Select(x => new UretimKayitResponseDto
                {
                    ID = x.ID,
                    Urun20liKod = x.Urun20liKod,
                    Malzeme12liKod = x.Malzeme12liKod,
                    IstasyonAdi = x.IstasyonAdi,
                    KaliteDurumu = x.KaliteDurumu,
                    UretimTarihi = x.UretimTarihi
                })
                .ToListAsync(cancellationToken);

            return Ok(sonuc);
        }

        // 4. Yeni Üretim Kaydı Ekle (POST: api/Uretim)
        [HttpPost]
        [Microsoft.AspNetCore.Authorization.Authorize(Policy = PolicyNames.ProductionWrite)]
        public async Task<IActionResult> UretimEkle([FromBody] CreateUretimKayitDto yeniDto)
        {
            // FluentValidation Doğrulaması
            var validationResult = await _validator.ValidateAsync(yeniDto);
            if (!validationResult.IsValid)
            {
                return BadRequest(new ValidationProblemDetails(validationResult.Errors
                    .GroupBy(error => error.PropertyName)
                    .ToDictionary(
                        group => group.Key,
                        group => group.Select(error => error.ErrorMessage).ToArray())));
            }

            // Mükerrer Barkod Kontrolü
            var mukerrerVarMi = await _context.UretimKayitlari
                .AnyAsync(x => x.Urun20liKod == yeniDto.Urun20liKod && !x.IsDeleted);

            if (mukerrerVarMi)
            {
                return Problem(
                    statusCode: StatusCodes.Status409Conflict,
                    title: "Barkod zaten kayıtlı.",
                    detail: $"'{yeniDto.Urun20liKod}' barkodlu aktif ürün kaydı zaten var.");
            }

            var yeniKayit = new UretimKayit
            {
                Urun20liKod = yeniDto.Urun20liKod,
                Malzeme12liKod = yeniDto.Malzeme12liKod,
                IstasyonAdi = yeniDto.IstasyonAdi,
                KaliteDurumu = yeniDto.KaliteDurumu,
                UretimTarihi = DateTime.Now,
                IsDeleted = false
            };

            _context.UretimKayitlari.Add(yeniKayit);
            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException)
            {
                return Problem(
                    statusCode: StatusCodes.Status409Conflict,
                    title: "Barkod zaten kayıtlı.",
                    detail: $"'{yeniDto.Urun20liKod}' barkodlu aktif ürün kaydı zaten var.");
            }

            var responseDto = new UretimKayitResponseDto
            {
                ID = yeniKayit.ID,
                Urun20liKod = yeniKayit.Urun20liKod,
                Malzeme12liKod = yeniKayit.Malzeme12liKod,
                IstasyonAdi = yeniKayit.IstasyonAdi,
                KaliteDurumu = yeniKayit.KaliteDurumu,
                UretimTarihi = yeniKayit.UretimTarihi
            };

            return CreatedAtAction(nameof(GetUretimById), new { id = yeniKayit.ID }, responseDto);
        }

        // 5. Üretim Kaydını Güncelle (PUT: api/Uretim/5)
        [HttpPut("{id}")]
        [Microsoft.AspNetCore.Authorization.Authorize(Policy = PolicyNames.ProductionManage)]
        public async Task<IActionResult> UretimGuncelle(int id, [FromBody] CreateUretimKayitDto guncelDto)
        {
            var validationResult = await _validator.ValidateAsync(guncelDto);
            if (!validationResult.IsValid)
            {
                return BadRequest(new ValidationProblemDetails(validationResult.Errors
                    .GroupBy(error => error.PropertyName)
                    .ToDictionary(
                        group => group.Key,
                        group => group.Select(error => error.ErrorMessage).ToArray())));
            }

            var mevcutKayit = await _context.UretimKayitlari.FindAsync(id);
            if (mevcutKayit == null || mevcutKayit.IsDeleted)
            {
                return Problem(statusCode: StatusCodes.Status404NotFound, title: $"{id} ID'li güncellenecek kayıt bulunamadı.");
            }

            mevcutKayit.IstasyonAdi = guncelDto.IstasyonAdi;
            mevcutKayit.KaliteDurumu = guncelDto.KaliteDurumu;
            mevcutKayit.Malzeme12liKod = guncelDto.Malzeme12liKod;

            await _context.SaveChangesAsync();

            var responseDto = new UretimKayitResponseDto
            {
                ID = mevcutKayit.ID,
                Urun20liKod = mevcutKayit.Urun20liKod,
                Malzeme12liKod = mevcutKayit.Malzeme12liKod,
                IstasyonAdi = mevcutKayit.IstasyonAdi,
                KaliteDurumu = mevcutKayit.KaliteDurumu,
                UretimTarihi = mevcutKayit.UretimTarihi
            };

            return Ok(responseDto);
        }

        // 6. Soft Delete ile Sil (DELETE: api/Uretim/5)
        [HttpDelete("{id}")]
        [Microsoft.AspNetCore.Authorization.Authorize(Policy = PolicyNames.ProductionManage)]
        public async Task<IActionResult> UretimSil(int id)
        {
            var uretimKayit = await _context.UretimKayitlari.FindAsync(id);
            if (uretimKayit == null || uretimKayit.IsDeleted)
            {
                return Problem(statusCode: StatusCodes.Status404NotFound, title: $"{id} ID'li aktif üretim kaydı bulunamadı.");
            }

            uretimKayit.IsDeleted = true;
            await _context.SaveChangesAsync();

            return Ok(new { id, message = "Üretim kaydı silindi." });
        }

        [HttpDelete("hard-delete/{id}")]
        [Microsoft.AspNetCore.Authorization.Authorize(Policy = PolicyNames.ProductionHardDelete)]
        public async Task<IActionResult> HardDelete(int id)
        {
            var kayit = await _context.UretimKayitlari.FirstOrDefaultAsync(x => x.ID == id);
            if (kayit == null)
            {
                return Problem(statusCode: StatusCodes.Status404NotFound, title: "Kayıt bulunamadı.");
            }

            _context.UretimKayitlari.Remove(kayit);
            await _context.SaveChangesAsync();

            return Ok(new { id, message = "Kayıt kalıcı olarak silindi." });
        }

        // 7. Silinen Kayıtları Listele (GET: api/Uretim/deleted)
        [HttpGet("deleted")]
        [Microsoft.AspNetCore.Authorization.Authorize(Policy = PolicyNames.DeletedRecordsRead)]
        public async Task<IActionResult> GetDeletedUretimler(
            [FromQuery] int limit = 100,
            CancellationToken cancellationToken = default)
        {
            limit = Math.Clamp(limit, 1, 500);

            var silinenler = await _context.UretimKayitlari
                .Where(x => x.IsDeleted)
                .AsNoTracking()
                .OrderByDescending(x => x.UretimTarihi)
                .Take(limit)
                .Select(x => new UretimKayitResponseDto
                {
                    ID = x.ID,
                    Urun20liKod = x.Urun20liKod,
                    Malzeme12liKod = x.Malzeme12liKod,
                    IstasyonAdi = x.IstasyonAdi,
                    KaliteDurumu = x.KaliteDurumu,
                    UretimTarihi = x.UretimTarihi
                })
                .ToListAsync(cancellationToken);

            return Ok(silinenler);
        }

        // 8. Silinen Kayıtları Geri Yükle (PUT: api/Uretim/restore/5)
        [HttpPut("restore/{id}")]
        [Microsoft.AspNetCore.Authorization.Authorize(Policy = PolicyNames.ProductionManage)]
        public async Task<IActionResult> RestoreUretim(int id)
        {
            var uretimKayit = await _context.UretimKayitlari.FindAsync(id);
            if (uretimKayit == null || !uretimKayit.IsDeleted)
            {
                return Problem(statusCode: StatusCodes.Status404NotFound, title: $"{id} ID'li silinmiş kayıt bulunamadı.");
            }

            uretimKayit.IsDeleted = false;
            await _context.SaveChangesAsync();

            return Ok(new { id, message = "Kayıt başarıyla geri yüklendi." });
        }

        
    }
}
