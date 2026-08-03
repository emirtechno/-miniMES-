using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MiniMesApi.Models
{
    [Table("Alarms")]
    public class Alarm
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [StringLength(100)]
        public string Title { get; set; } = string.Empty;

        [StringLength(80)]
        public string Station { get; set; } = string.Empty;

        [Required]
        [StringLength(20)]
        public string Severity { get; set; } = "Uyarı";

        public DateTimeOffset Time { get; set; } = DateTimeOffset.UtcNow;

        [Required]
        [StringLength(20)]
        public string Status { get; set; } = "Açık";

        [StringLength(400)]
        public string Description { get; set; } = string.Empty;

        public DateTimeOffset? AcknowledgedAt { get; set; }

        [StringLength(100)]
        public string? AcknowledgedBy { get; set; }

        public DateTimeOffset? ResolvedAt { get; set; }

        [StringLength(100)]
        public string? ResolvedBy { get; set; }
    }
}
