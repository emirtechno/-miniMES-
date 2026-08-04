namespace MiniMesApi.DTOs;

public sealed class StartFactorySimulationRequest
{
    /// <summary>
    /// Optional station filter. Empty = all production lines (montaj / elektronik / paketleme).
    /// </summary>
    public string[]? StationIds { get; init; }

    /// <summary>
    /// When true, leave existing open lots alone and only fill stations that lack an open lot.
    /// Default false: seed a fresh WO+lot per selected line.
    /// </summary>
    public bool ReuseOpenLots { get; init; }
}

public sealed class FactorySimulationLineDto
{
    public string StationId { get; init; } = string.Empty;
    public int WorkOrderId { get; init; }
    public string OrderNo { get; init; } = string.Empty;
    public string Product { get; init; } = string.Empty;
    public string WorkOrderStatus { get; init; } = string.Empty;
    public int PlannedQuantity { get; init; }
    public int BatchId { get; init; }
    public string LotNo { get; init; } = string.Empty;
    public string BatchStatus { get; init; } = string.Empty;
    public int TargetQuantity { get; init; }
    public int ProducedQuantity { get; init; }
}

public sealed class FactorySimulationStartResultDto
{
    public DateTimeOffset StartedAt { get; init; }
    public int LineCount { get; init; }
    public IReadOnlyList<FactorySimulationLineDto> Lines { get; init; } = [];
    public string Message { get; init; } = string.Empty;
}

public sealed class FactorySimulationStatusDto
{
    public bool HasOpenSimulationLots { get; init; }
    public int OpenLotCount { get; init; }
    public int OpenWorkOrderCount { get; init; }
    public IReadOnlyList<FactorySimulationLineDto> Lines { get; init; } = [];
}
