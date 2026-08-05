using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MiniMesApi.Models
{
    /// <summary>
    /// Optional barcode / unit-level production record path (API exists).
    /// Shop-floor OEE and shift KPIs use MachineMetrics + ScrapLogs, not this table.
    /// </summary>
    [Table("UretimKayitlari")]
    public class UretimKayit
    {
        [Key]
        public int ID { get; set; }

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

        public DateTimeOffset? DeletedAtUtc { get; set; }

        [StringLength(80)]
        public string? DeletedByUserId { get; set; }

        [StringLength(100)]
        public string? DeletedByUsername { get; set; }
    }
}
