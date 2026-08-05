using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MiniMesApi.Models;

[Table("ScrapLogs")]
public class ScrapLog
{
    public int Id { get; set; }

    [Required]
    [StringLength(80)]
    public string StationId { get; set; } = string.Empty;

    public int Quantity { get; set; }

    [StringLength(80)]
    public string? ReasonCode { get; set; }

    public int? WorkOrderId { get; set; }
    public WorkOrder? WorkOrder { get; set; }

    public int? BatchId { get; set; }
    public Batch? Batch { get; set; }

    public int? ShiftSessionId { get; set; }
    public ShiftSession? ShiftSession { get; set; }

    [Required]
    [StringLength(120)]
    public string OperatorUserId { get; set; } = string.Empty;

    public DateTimeOffset RecordedAt { get; set; } = DateTimeOffset.UtcNow;

    public int? MachineMetricId { get; set; }
    public MachineMetric? MachineMetric { get; set; }
}
