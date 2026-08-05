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

    public int? ActiveBatchId { get; set; }
    public Batch? ActiveBatch { get; set; }

    public DateTimeOffset StartedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? EndedAt { get; set; }

    /// <summary>Set when status becomes OnBreak; cleared on resume/end.</summary>
    public DateTimeOffset? BreakStartedAt { get; set; }

    /// <summary>Set when status becomes InSetup; cleared on resume/end.</summary>
    public DateTimeOffset? SetupStartedAt { get; set; }

    [Required]
    [StringLength(20)]
    public string Status { get; set; } = ShiftSessionStatuses.Active;

    [StringLength(80)]
    public string? BreakReason { get; set; }

    /// <summary>Persisted on end-shift; null while session is open.</summary>
    public int? GoodCount { get; set; }

    public int? NokCount { get; set; }

    /// <summary>Sum of ScrapLogs.Quantity for this session.</summary>
    public int? ScrapEntered { get; set; }

    public double? DowntimeSeconds { get; set; }

    public double? OeePercent { get; set; }

    /// <summary>Optional JSON snapshot of end-shift summary (actual, duration, etc.).</summary>
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
