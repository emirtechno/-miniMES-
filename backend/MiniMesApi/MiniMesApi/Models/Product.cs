using System.ComponentModel.DataAnnotations;

namespace MiniMesApi.Models;

public class Product
{
    public int Id { get; set; }

    [Required]
    [StringLength(50)]
    public string ProductCode { get; set; } = string.Empty;

    [Required]
    [StringLength(100)]
    public string ProductName { get; set; } = string.Empty;

    [StringLength(400)]
    public string Description { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    // İlişkiler
    public ICollection<Batch>? Batches { get; set; }
}