using System.ComponentModel.DataAnnotations;

/// <summary>Eski izlenebilirlik Users tablosu — düşürüldü; Identity AspNetUsers kullanır.</summary>
[Obsolete("Legacy Traceability Users table removed. Use ApplicationUser / AspNetUsers.")]
public class User
{
    public int Id { get; set; }

    [Required]
    [StringLength(50)]
    public string Username { get; set; } = string.Empty;

    [Required]
    [StringLength(100)]
    public string FullName { get; set; } = string.Empty;

    [Required]
    [StringLength(30)]
    public string Role { get; set; } = "Operator";

    [Required]
    [StringLength(40)]
    public string Shift { get; set; } = "08:00 - 16:00";
}