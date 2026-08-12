using System.ComponentModel.DataAnnotations;

namespace MiniMesApi.DTOs;

public sealed class SimulationStatusDto
{
    public bool Enabled { get; init; }
    public string Source { get; init; } = "backend";
    public DateTimeOffset UpdatedAt { get; init; }
    public string? UpdatedBy { get; init; }
}

public sealed class SetSimulationEnabledDto
{
    public bool Enabled { get; set; }
}

/// <summary>Yıkıcı demo sıfırlama — tam onay cümlesi gerekir.</summary>
public sealed class ResetShopFloorDto
{
    /// <summary>Tam olarak <c>SIFIRLA</c> olmalı (büyük/küçük harf duyarlı).</summary>
    [Required]
    [StringLength(32)]
    public string Confirmation { get; set; } = string.Empty;
}

public sealed class ShopFloorResetResultDto
{
    public DateTimeOffset ResetAt { get; init; }
    public string RequestedBy { get; init; } = string.Empty;
    public int MachineMetricsDeleted { get; init; }
    public int ScrapLogsDeleted { get; init; }
    public int AlarmsDeleted { get; init; }
    public int DowntimeEventsDeleted { get; init; }
    public int ShiftSessionEventsDeleted { get; init; }
    public int ShiftSessionsDeleted { get; init; }
    public int StationRuntimesReset { get; init; }
    public int WorkOrdersProgressCleared { get; init; }
    public int UretimKayitlariDeleted { get; init; }
}
