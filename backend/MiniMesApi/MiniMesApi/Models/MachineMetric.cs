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

        /// <summary>Operator ShiftSession that owns this tick (null for legacy / no open session).</summary>
        public int? ShiftSessionId { get; set; }

        public double IdealCycleTimeSeconds { get; set; }
        public int ActualProductionCount { get; set; }
        public int GoodProductionCount { get; set; }

        /// <summary>Optional physical gauge (°C). Null for legacy rows.</summary>
        public double? Temperature { get; set; }

        /// <summary>Optional spindle/line RPM. Null for legacy rows.</summary>
        public double? Rpm { get; set; }

        /// <summary>Optional vibration (mm/s). Null for legacy rows.</summary>
        public double? Vibration { get; set; }

        public DateTimeOffset RecordedAt { get; set; } = DateTimeOffset.UtcNow;
    }
}
