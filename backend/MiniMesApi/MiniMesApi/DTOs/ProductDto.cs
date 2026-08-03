namespace MiniMesApi.DTOs
{
    public class CreateProductDto
    {
        public string ProductCode { get; set; } = string.Empty;
        public string ProductName { get; set; } = string.Empty;
        public string? Description { get; set; }
    }

    public class ProductResponseDto
    {
        public int Id { get; set; }
        public string ProductCode { get; set; } = string.Empty;
        public string ProductName { get; set; } = string.Empty;
        public string? Description { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
    }
}