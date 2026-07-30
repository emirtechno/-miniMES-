public class User
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Role { get; set; } = "Operator"; // Admin, Operator, ShiftLeader
    public string Shift { get; set; } = "08:00 - 16:00"; // Vardiya
}