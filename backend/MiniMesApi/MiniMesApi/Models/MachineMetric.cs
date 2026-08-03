using System.ComponentModel.DataAnnotations;

namespace MiniMesApi.Models
{
    public class MachineMetric
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [StringLength(80)]
        public string StationId { get; set; } = string.Empty;

        // Planlanan Toplam Çalışma Süresi (Saniye)
        public double PlannedProductionSeconds { get; set; }

        // Toplam Duruş Süresi (Saniye)
        public double DowntimeSeconds { get; set; }

        [Required]
        [StringLength(40)]
        public string DowntimeReasonCode { get; set; } = DowntimeReasonCatalog.None;

        [Required]
        [StringLength(20)]
        public string ShiftCode { get; set; } = ShiftCatalog.ShiftA;

        // Parça Başına Olması Gereken İdeal Süre (Saniye)
        public double IdealCycleTimeSeconds { get; set; }

        // Üretilen Toplam Adet (Sağlam + Fire)
        public int ActualProductionCount { get; set; }

        // Sağlam Üretilen Adet (OK)
        public int GoodProductionCount { get; set; }

        // Kayıt Tarihi
        public DateTimeOffset RecordedAt { get; set; } = DateTimeOffset.UtcNow;
    }
}
