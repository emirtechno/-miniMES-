using System.ComponentModel.DataAnnotations;

namespace MiniMesApi.Models
{
    public class WorkOrder
    {
        public int Id { get; set; }

        [Required]
        [StringLength(50)]
        public string OrderNo { get; set; } = string.Empty;

        [Required]
        [StringLength(100)]
        public string Product { get; set; } = string.Empty;

        /// <summary>Optional FK to Products catalog (nullable; Product string remains SSOT for display).</summary>
        public int? ProductId { get; set; }

        public Product? ProductRef { get; set; }

        [Required]
        [StringLength(80)]
        public string Station { get; set; } = string.Empty;

        public int Quantity { get; set; }

        /// <summary>Good units completed from telemetry (0 ≤ CompletedQuantity ≤ Quantity).</summary>
        public int CompletedQuantity { get; set; }

        [Required]
        [StringLength(30)]
        public string Status { get; set; } = "Bekliyor";

        [Timestamp]
        public byte[] RowVersion { get; set; } = [];

        public ICollection<Batch> Lots { get; set; } = new List<Batch>();
    }
}
