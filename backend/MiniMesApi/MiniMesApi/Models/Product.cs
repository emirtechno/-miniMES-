namespace MiniMesApi.Models; // <-- Bu satır şarttır

public class Product
{
    public int Id { get; set; }
    public string ProductCode { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.Now;

    // İlişkiler
    public ICollection<Batch>? Batches { get; set; }
}