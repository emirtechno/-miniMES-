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

        /// <summary>İsteğe bağlı Products katalog FK (nullable; görüntüleme SSOT'u Product string'dir).</summary>
        public int? ProductId { get; set; }

        public Product? ProductRef { get; set; }

        [Required]
        [StringLength(80)]
        public string Station { get; set; } = string.Empty;

        public int Quantity { get; set; }

        /// <summary>Telemetriden tamamlanan iyi adet (0 ≤ CompletedQuantity ≤ Quantity).</summary>
        public int CompletedQuantity { get; set; }

        [Required]
        [StringLength(30)]
        public string Status { get; set; } = "Bekliyor";

        /// <summary>Soft-delete zaman damgası; null ise iş emri listelerde görünür.</summary>
        public DateTimeOffset? DeletedAt { get; set; }

        [Timestamp]
        public byte[] RowVersion { get; set; } = [];
    }
}
