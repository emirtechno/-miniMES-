using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MiniMesApi.Models
{
    [Table("UretimKayitlari")]
    public class UretimKayit
    {
        [Key]
        public int ID { get; set; } // Birincil anahtarımız bu (Hepsi büyük ID)

        [Required]
        [StringLength(20)]
        public string Urun20liKod { get; set; } = string.Empty;

        [Required]
        [StringLength(12)]
        public string Malzeme12liKod { get; set; } = string.Empty;

        public DateTimeOffset UretimTarihi { get; set; } = DateTimeOffset.UtcNow;

        [Required]
        [StringLength(50)]
        public string IstasyonAdi { get; set; } = string.Empty;

        [StringLength(10)]
        public string KaliteDurumu { get; set; } = "OK";

        public bool IsDeleted { get; set; } = false;
    }
}