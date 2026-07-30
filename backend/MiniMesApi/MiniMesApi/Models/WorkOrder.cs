namespace MiniMesApi.Models
{
    public class WorkOrder
    {
        public int Id { get; set; }
        public string OrderNo { get; set; } = string.Empty;
        public string Product { get; set; } = string.Empty;
        public string Station { get; set; } = string.Empty;
        public int Quantity { get; set; }
        public string Status { get; set; } = "Bekliyor";
    }
}