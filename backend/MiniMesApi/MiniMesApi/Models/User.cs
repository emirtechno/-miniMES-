using System.ComponentModel.DataAnnotations;

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