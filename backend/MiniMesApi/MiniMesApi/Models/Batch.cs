namespace MiniMesApi.Models
{
    public class Batch
    {
        public int Id { get; set; }
        public string LotNo { get; set; } = string.Empty;
        public string Product { get; set; } = string.Empty;
        public string Station { get; set; } = string.Empty;
        public string Status { get; set; } = "İşlemde";
        public string UpdatedAt { get; set; } = DateTime.Now.ToString("HH:mm");
    }
}