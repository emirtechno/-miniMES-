using System.ComponentModel.DataAnnotations;

namespace MiniMesApi.DTOs;

public sealed class StartShiftSessionDto
{
    [Required]
    [StringLength(80)]
    public string StationId { get; init; } = string.Empty;

    [Required]
    [StringLength(20)]
    public string ShiftCode { get; init; } = string.Empty;

    [StringLength(120)]
    public string? OperatorName { get; init; }

    [StringLength(120)]
    public string? SecondaryOperatorName { get; init; }

    [StringLength(120)]
    public string? SecondaryOperatorUserId { get; init; }

    /// <summary>Bu oturum için isteğe bağlı aktif iş emri (UI seçimi sonra eklenebilir).</summary>
    public int? ActiveWorkOrderId { get; init; }
}

public sealed class ShiftDowntimeDto
{
    [Required]
    [StringLength(80)]
    public string ReasonCode { get; init; } = string.Empty;

    [StringLength(120)]
    public string? ReasonName { get; init; }

    public bool IsPlanned { get; init; }
    public bool Emergency { get; init; }
}

public sealed class ShiftSessionDto
{
    public int Id { get; init; }
    public string UserId { get; init; } = string.Empty;
    public string StationId { get; init; } = string.Empty;
    public string ShiftCode { get; init; } = string.Empty;
    public string ShiftName { get; init; } = string.Empty;
    public string OperatorName { get; init; } = string.Empty;
    public string? SecondaryOperatorName { get; init; }
    public string? SecondaryOperatorUserId { get; init; }
    public int? ActiveWorkOrderId { get; init; }
    public DateTimeOffset StartedAt { get; init; }
    public DateTimeOffset? EndedAt { get; init; }
    public DateTimeOffset? BreakStartedAt { get; init; }
    public DateTimeOffset? SetupStartedAt { get; init; }
    public string Status { get; init; } = string.Empty;
    public string? BreakReason { get; init; }
    public bool Active => Status is "Active" or "OnBreak" or "InSetup";
    public bool OnBreak => Status == "OnBreak";
    public bool InSetup => Status == "InSetup";
    /// <summary>StationRuntime modu: Running / Paused / Down.</summary>
    public string? RuntimeMode { get; init; }
    public string? PauseReason { get; init; }
    public bool HasBlockingAlarms { get; init; }
    public ShiftSessionSummaryDto? Summary { get; init; }
}

public sealed class ShiftSessionSummaryDto
{
    public int DurationMinutes { get; init; }
    public int GoodCount { get; init; }
    public int ActualCount { get; init; }
    public int NokCount { get; init; }
    public int ScrapLogQuantity { get; init; }
    public double DowntimeSeconds { get; init; }
    public double? OeePercent { get; init; }
}

public sealed class ShiftSessionEventDto
{
    public int Id { get; init; }
    public string FromStatus { get; init; } = string.Empty;
    public string ToStatus { get; init; } = string.Empty;
    public string? ReasonCode { get; init; }
    public DateTimeOffset OccurredAt { get; init; }
    public string? ActorUserId { get; init; }
    public string? Notes { get; init; }
}

public sealed class ShiftSessionDetailDto
{
    public ShiftSessionDto Session { get; init; } = null!;
    public IReadOnlyList<MachineMetricDto> RecentTicks { get; init; } = [];
    public IReadOnlyList<ShiftSessionEventDto> Events { get; init; } = [];
}

/// <summary>
/// Andon / TV panoları için fabrika geneli açık ShiftSession satırı (istasyon başına bir).
/// Oturumda henüz etiketli/pencere metriği yoksa <see cref="Oee"/> null olur.
/// </summary>
public sealed class ShiftSessionBoardItemDto
{
    public int SessionId { get; init; }
    public string StationId { get; init; } = string.Empty;
    public string ShiftCode { get; init; } = string.Empty;
    public string ShiftName { get; init; } = string.Empty;
    public string OperatorName { get; init; } = string.Empty;
    public string? SecondaryOperatorName { get; init; }
    public string Status { get; init; } = string.Empty;
    public DateTimeOffset StartedAt { get; init; }
    public OeeMetricDto? Oee { get; init; }
}
