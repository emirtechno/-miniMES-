using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MiniMesApi.Models;

public static class ShiftSessionStatuses
{
    public const string Active = "Active";
    public const string OnBreak = "OnBreak";
    public const string InSetup = "InSetup";
    public const string Ended = "Ended";

    public static readonly string[] All = [Active, OnBreak, InSetup, Ended];
}

[Table("ShiftSessions")]
public class ShiftSession
{
    public int Id { get; set; }

    [Required]
    [StringLength(120)]
    public string UserId { get; set; } = string.Empty;

    [Required]
    [StringLength(80)]
    public string StationId { get; set; } = string.Empty;

    [Required]
    [StringLength(20)]
    public string ShiftCode { get; set; } = ShiftCatalog.ShiftA;

    [Required]
    [StringLength(120)]
    public string OperatorName { get; set; } = string.Empty;

    [StringLength(120)]
    public string? SecondaryOperatorName { get; set; }

    [StringLength(120)]
    public string? SecondaryOperatorUserId { get; set; }

    public int? ActiveWorkOrderId { get; set; }
    public WorkOrder? ActiveWorkOrder { get; set; }

    public DateTimeOffset StartedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? EndedAt { get; set; }

    /// <summary>Status OnBreak olunca set edilir; resume/end'de temizlenir.</summary>
    public DateTimeOffset? BreakStartedAt { get; set; }

    /// <summary>Status InSetup olunca set edilir; resume/end'de temizlenir.</summary>
    public DateTimeOffset? SetupStartedAt { get; set; }

    [Required]
    [StringLength(20)]
    public string Status { get; set; } = ShiftSessionStatuses.Active;

    [StringLength(80)]
    public string? BreakReason { get; set; }

    /// <summary>Vardiya bitiminde kalıcı; oturum açıkken null.</summary>
    public int? GoodCount { get; set; }

    public int? NokCount { get; set; }

    /// <summary>Bu oturum için ScrapLogs.Quantity toplamı.</summary>
    public int? ScrapEntered { get; set; }

    public double? DowntimeSeconds { get; set; }

    public double? OeePercent { get; set; }

    /// <summary>İsteğe bağlı vardiya-bitiş özeti JSON anlık görüntüsü (actual, süre vb.).</summary>
    [StringLength(4000)]
    public string? SummaryJson { get; set; }

    [StringLength(120)]
    public string? CreatedBy { get; set; }

    [StringLength(120)]
    public string? UpdatedBy { get; set; }

    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<DowntimeEvent> DowntimeEvents { get; set; } = new List<DowntimeEvent>();
    public ICollection<ShiftSessionEvent> Events { get; set; } = new List<ShiftSessionEvent>();
}
