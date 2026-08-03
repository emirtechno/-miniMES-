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

        [Required]
        [StringLength(80)]
        public string Station { get; set; } = string.Empty;

        public int Quantity { get; set; }

        [Required]
        [StringLength(30)]
        public string Status { get; set; } = "Bekliyor";

        [Timestamp]
        public byte[] RowVersion { get; set; } = [];
    }
}