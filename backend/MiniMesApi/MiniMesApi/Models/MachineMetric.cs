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

        public double PlannedProductionSeconds { get; set; }
        public double DowntimeSeconds { get; set; }

        [Required]
        [StringLength(40)]
        public string DowntimeReasonCode { get; set; } = DowntimeReasonCatalog.None;

        [Required]
        [StringLength(20)]
        public string ShiftCode { get; set; } = ShiftCatalog.ShiftA;

        /// <summary>Bu tick'in sahibi operatör ShiftSession (legacy / açık oturum yoksa null).</summary>
        public int? ShiftSessionId { get; set; }

        public double IdealCycleTimeSeconds { get; set; }
        public int ActualProductionCount { get; set; }
        public int GoodProductionCount { get; set; }

        /// <summary>İsteğe bağlı fiziksel gösterge (°C). Eski satırlarda null.</summary>
        public double? Temperature { get; set; }

        /// <summary>İsteğe bağlı mil/hat RPM. Eski satırlarda null.</summary>
        public double? Rpm { get; set; }

        /// <summary>İsteğe bağlı titreşim (mm/s). Eski satırlarda null.</summary>
        public double? Vibration { get; set; }

        public DateTimeOffset RecordedAt { get; set; } = DateTimeOffset.UtcNow;
    }
}
