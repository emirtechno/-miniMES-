using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MiniMesApi.Models;

public static class DowntimeEventSources
{
    public const string Operator = "Operator";
    public const string Simulation = "Simulation";
    public const string Alarm = "Alarm";

    public static readonly string[] All = [Operator, Simulation, Alarm];
}

[Table("DowntimeEvents")]
public class DowntimeEvent
{
    public int Id { get; set; }

    public int? ShiftSessionId { get; set; }
    public ShiftSession? ShiftSession { get; set; }

    [Required]
    [StringLength(80)]
    public string StationId { get; set; } = string.Empty;

    [Required]
    [StringLength(80)]
    public string ReasonCode { get; set; } = string.Empty;

    [StringLength(120)]
    public string? ReasonName { get; set; }

    public bool IsPlanned { get; set; }

    public bool IsEmergency { get; set; }

    public DateTimeOffset StartedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset? EndedAt { get; set; }

    public int? DurationSeconds { get; set; }

    [Required]
    [StringLength(20)]
    public string Source { get; set; } = DowntimeEventSources.Operator;

    public int? AlarmId { get; set; }
    public Alarm? Alarm { get; set; }

    public int? MachineMetricId { get; set; }
    public MachineMetric? MachineMetric { get; set; }
}
