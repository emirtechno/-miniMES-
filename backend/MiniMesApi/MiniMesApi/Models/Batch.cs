using System.ComponentModel.DataAnnotations;

namespace MiniMesApi.Models
{
    public class Batch
    {
        public int Id { get; set; }

        [Required]
        [StringLength(50)]
        public string LotNo { get; set; } = string.Empty;

        [Required]
        [StringLength(100)]
        public string Product { get; set; } = string.Empty;

        [Required]
        [StringLength(80)]
        public string Station { get; set; } = string.Empty;

        [Required]
        [StringLength(30)]
        public string Status { get; set; } = BatchStatuses.InProgress;

        public int TargetQuantity { get; set; } = 100;

        public int ProducedQuantity { get; set; }

        public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    }
}
