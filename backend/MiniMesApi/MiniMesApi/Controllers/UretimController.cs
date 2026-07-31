using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using FluentValidation;
using MiniMesApi.Models;
using MiniMesApi.DTOs;

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
        public async Task<IActionResult> GetUretimler()
        {
            var uretimler = await _context.UretimKayitlari
                .Where(x => !x.IsDeleted)
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
                .ToListAsync();

            return Ok(ApiResponse<List<UretimKayitResponseDto>>.SuccessResult(uretimler, "Aktif üretim kayıtları getirildi."));
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
                return NotFound(ApiResponse<string>.FailResult($"{id} ID'li ürün kaydı bulunamadı."));
            }

            return Ok(ApiResponse<UretimKayitResponseDto>.SuccessResult(kayit));
        }

        // 3. İstasyon veya Kalite Durumuna Göre Filtrele (GET: api/Uretim/filtre)
        [HttpGet("filtre")]
        public async Task<IActionResult> Filtrele([FromQuery] string? istasyon, [FromQuery] string? kaliteDurumu)
        {
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
                .Select(x => new UretimKayitResponseDto
                {
                    ID = x.ID,
                    Urun20liKod = x.Urun20liKod,
                    Malzeme12liKod = x.Malzeme12liKod,
                    IstasyonAdi = x.IstasyonAdi,
                    KaliteDurumu = x.KaliteDurumu,
                    UretimTarihi = x.UretimTarihi
                })
                .ToListAsync();

            return Ok(ApiResponse<List<UretimKayitResponseDto>>.SuccessResult(sonuc, "Filtrelenmiş kayıtlar getirildi."));
        }

        // 4. Yeni Üretim Kaydı Ekle (POST: api/Uretim)
        [HttpPost]
        [Microsoft.AspNetCore.Authorization.Authorize(Roles = "Admin,Operator")]
        public async Task<IActionResult> UretimEkle([FromBody] CreateUretimKayitDto yeniDto)
        {
            // FluentValidation Doğrulaması
            var validationResult = await _validator.ValidateAsync(yeniDto);
            if (!validationResult.IsValid)
            {
                var hatalar = validationResult.Errors.Select(e => e.ErrorMessage).ToList();
                return BadRequest(ApiResponse<string>.FailResult("Validasyon hatası oluştu.", hatalar));
            }

            // Mükerrer Barkod Kontrolü
            var mukerrerVarMi = await _context.UretimKayitlari
                .AnyAsync(x => x.Urun20liKod == yeniDto.Urun20liKod && !x.IsDeleted);

            if (mukerrerVarMi)
            {
                return BadRequest(ApiResponse<string>.FailResult($"'{yeniDto.Urun20liKod}' barkodlu ürün zaten veritabanında kayıtlı!"));
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
            await _context.SaveChangesAsync();

            var responseDto = new UretimKayitResponseDto
            {
                ID = yeniKayit.ID,
                Urun20liKod = yeniKayit.Urun20liKod,
                Malzeme12liKod = yeniKayit.Malzeme12liKod,
                IstasyonAdi = yeniKayit.IstasyonAdi,
                KaliteDurumu = yeniKayit.KaliteDurumu,
                UretimTarihi = yeniKayit.UretimTarihi
            };

            return CreatedAtAction(nameof(GetUretimById), new { id = yeniKayit.ID }, ApiResponse<UretimKayitResponseDto>.SuccessResult(responseDto, "Yeni üretim kaydı oluşturuldu."));
        }

        // 5. Üretim Kaydını Güncelle (PUT: api/Uretim/5)
        [HttpPut("{id}")]
        [Microsoft.AspNetCore.Authorization.Authorize(Roles = "Admin")]
        public async Task<IActionResult> UretimGuncelle(int id, [FromBody] CreateUretimKayitDto guncelDto)
        {
            var validationResult = await _validator.ValidateAsync(guncelDto);
            if (!validationResult.IsValid)
            {
                var hatalar = validationResult.Errors.Select(e => e.ErrorMessage).ToList();
                return BadRequest(ApiResponse<string>.FailResult("Validasyon hatası oluştu.", hatalar));
            }

            var mevcutKayit = await _context.UretimKayitlari.FindAsync(id);
            if (mevcutKayit == null || mevcutKayit.IsDeleted)
            {
                return NotFound(ApiResponse<string>.FailResult($"{id} ID'li güncellenecek kayıt bulunamadı!"));
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

            return Ok(ApiResponse<UretimKayitResponseDto>.SuccessResult(responseDto, $"{id} ID'li üretim kaydı güncellendi."));
        }

        // 6. Soft Delete ile Sil (DELETE: api/Uretim/5)
        [HttpDelete("{id}")]
        [Microsoft.AspNetCore.Authorization.Authorize(Roles = "Admin")]
        public async Task<IActionResult> UretimSil(int id)
        {
            var uretimKayit = await _context.UretimKayitlari.FindAsync(id);
            if (uretimKayit == null || uretimKayit.IsDeleted)
            {
                return NotFound(ApiResponse<string>.FailResult($"{id} ID'li aktif üretim kaydı bulunamadı!"));
            }

            uretimKayit.IsDeleted = true;
            await _context.SaveChangesAsync();

            return Ok(ApiResponse<string>.SuccessResult($"{id} ID'li üretim kaydı silindi.", "İşlem başarılı."));
        }

        [HttpDelete("hard-delete/{id}")]
        [Microsoft.AspNetCore.Authorization.Authorize(Roles = "Admin")]
public async Task<IActionResult> HardDelete(int id)
{
    try
    {
        // Entity Framework Global Query Filter varsa IgnoreQueryFilters kullanıyoruz
        var kayit = await _context.UretimKayitlari.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.ID == id);
        if (kayit == null)
        {
            return NotFound(new ApiResponse<string> { Success = false, Message = "Kayıt bulunamadı." });
        }

        _context.UretimKayitlari.Remove(kayit);
        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<string> { Success = true, Message = "Kayıt kalıcı olarak silindi." });
    }
    catch (Exception)
    {
        return StatusCode(500, ApiResponse<string>.FailResult("Kalıcı silme sırasında beklenmeyen bir hata oluştu."));
    }
}

        // 7. Silinen Kayıtları Listele (GET: api/Uretim/deleted)
        [HttpGet("deleted")]
        public async Task<IActionResult> GetDeletedUretimler()
        {
            var silinenler = await _context.UretimKayitlari
                .Where(x => x.IsDeleted)
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
                .ToListAsync();

            return Ok(ApiResponse<List<UretimKayitResponseDto>>.SuccessResult(silinenler, "Silinmiş kayıtlar listelendi."));
        }

        // 8. Silinen Kayıtları Geri Yükle (PUT: api/Uretim/restore/5)
        [HttpPut("restore/{id}")]
        [Microsoft.AspNetCore.Authorization.Authorize(Roles = "Admin")]
        public async Task<IActionResult> RestoreUretim(int id)
        {
            var uretimKayit = await _context.UretimKayitlari.FindAsync(id);
            if (uretimKayit == null || !uretimKayit.IsDeleted)
            {
                return NotFound(ApiResponse<string>.FailResult($"{id} ID'li silinmiş kayıt bulunamadı."));
            }

            uretimKayit.IsDeleted = false;
            await _context.SaveChangesAsync();

            return Ok(ApiResponse<string>.SuccessResult($"{id} ID'li kayıt başarıyla geri yüklendi.", "İşlem başarılı."));
        }

        
    }
}
