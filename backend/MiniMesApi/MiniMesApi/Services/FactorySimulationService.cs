using Microsoft.EntityFrameworkCore;
using MiniMesApi.DTOs;
using MiniMesApi.Models;

namespace MiniMesApi.Services;

public interface IFactorySimulationService
{
    Task<FactorySimulationStartResultDto> StartAsync(
        StartFactorySimulationRequest request,
        CancellationToken cancellationToken = default);

    Task<FactorySimulationStatusDto> GetStatusAsync(CancellationToken cancellationToken = default);
}

public sealed class FactorySimulationService(MesDbContext context) : IFactorySimulationService
{
    private static readonly string[] ProductCatalog =
    [
        "Vestel Panel Montaj Kiti",
        "Elektronik Kart Modülü",
        "Kompresör Ünitesi",
        "Kapı / Gövde Montaj Seti",
        "Paketleme Ünitesi",
        "Soğutma Devresi Kiti"
    ];

    public async Task<FactorySimulationStartResultDto> StartAsync(
        StartFactorySimulationRequest request,
        CancellationToken cancellationToken = default)
    {
        var strategy = context.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            var stations = ResolveStations(request.StationIds);
            var stamp = DateTimeOffset.UtcNow.ToString("yyMMddHHmmss");
            var lines = new List<FactorySimulationLineDto>(stations.Count);
            var created = 0;

            await using var transaction = await context.Database.BeginTransactionAsync(cancellationToken);

            foreach (var stationId in stations)
            {
                if (request.ReuseOpenLots)
                {
                    var existing = await FindOpenLineAsync(stationId, cancellationToken);
                    if (existing is not null)
                    {
                        lines.Add(existing);
                        continue;
                    }
                }

                var plannedQty = Random.Shared.Next(200, 1501);
                var product = ProductCatalog[Random.Shared.Next(ProductCatalog.Length)];
                var stationToken = stationId.Replace("_", "", StringComparison.Ordinal).ToUpperInvariant();
                if (stationToken.Length > 12) stationToken = stationToken[..12];
                var orderNo = $"WO-SIM-{stamp}-{stationToken}-{created + 1:D2}";
                var lotNo = $"LOT-SIM-{stamp}-{stationToken}-{created + 1:D2}";

                var workOrder = new WorkOrder
                {
                    OrderNo = orderNo,
                    Product = product,
                    Station = stationId,
                    Quantity = plannedQty,
                    Status = WorkOrderStatuses.InProgress
                };
                context.WorkOrders.Add(workOrder);
                await context.SaveChangesAsync(cancellationToken);

                var batch = new Batch
                {
                    LotNo = lotNo,
                    Product = product,
                    Station = stationId,
                    Status = BatchStatuses.InProgress,
                    TargetQuantity = plannedQty,
                    ProducedQuantity = 0,
                    WorkOrderId = workOrder.Id,
                    UpdatedAt = DateTimeOffset.UtcNow
                };
                context.Batches.Add(batch);
                await context.SaveChangesAsync(cancellationToken);
                created++;

                lines.Add(ToLineDto(workOrder, batch));
            }

            await transaction.CommitAsync(cancellationToken);

            return new FactorySimulationStartResultDto
            {
                StartedAt = DateTimeOffset.UtcNow,
                LineCount = lines.Count,
                Lines = lines,
                Message = created > 0
                    ? $"{created} hat için rastgele iş emri + parti oluşturuldu; {lines.Count} hat simülasyona hazır."
                    : $"Mevcut açık partiler yeniden kullanıldı ({lines.Count} hat)."
            };
        });
    }

    public async Task<FactorySimulationStatusDto> GetStatusAsync(CancellationToken cancellationToken = default)
    {
        var productionStations = StationCatalog.ProductionLines;

        var openBatches = await context.Batches
            .AsNoTracking()
            .Where(batch => batch.Status != BatchStatuses.Completed
                && batch.ProducedQuantity < batch.TargetQuantity
                && productionStations.Contains(batch.Station))
            .OrderBy(batch => batch.Station)
            .ThenBy(batch => batch.Id)
            .ToListAsync(cancellationToken);

        var workOrderIds = openBatches
            .Where(batch => batch.WorkOrderId.HasValue)
            .Select(batch => batch.WorkOrderId!.Value)
            .Distinct()
            .ToList();

        var workOrders = await context.WorkOrders
            .AsNoTracking()
            .Where(order => workOrderIds.Contains(order.Id)
                || (order.Status != WorkOrderStatuses.Completed
                    && productionStations.Contains(order.Station)))
            .ToDictionaryAsync(order => order.Id, cancellationToken);

        var openWoCount = await context.WorkOrders
            .AsNoTracking()
            .CountAsync(
                order => order.Status != WorkOrderStatuses.Completed
                    && productionStations.Contains(order.Station),
                cancellationToken);

        // One open lot per station (FIFO) for status strip.
        var lines = new List<FactorySimulationLineDto>();
        foreach (var group in openBatches.GroupBy(batch => batch.Station))
        {
            var batch = group.OrderBy(item => item.Id).First();
            WorkOrder? wo = null;
            if (batch.WorkOrderId is int woId)
            {
                workOrders.TryGetValue(woId, out wo);
            }

            wo ??= workOrders.Values.FirstOrDefault(order =>
                order.Station == batch.Station && order.Status != WorkOrderStatuses.Completed);

            lines.Add(new FactorySimulationLineDto
            {
                StationId = batch.Station,
                WorkOrderId = wo?.Id ?? batch.WorkOrderId ?? 0,
                OrderNo = wo?.OrderNo ?? string.Empty,
                Product = batch.Product,
                WorkOrderStatus = wo?.Status ?? string.Empty,
                PlannedQuantity = wo?.Quantity ?? batch.TargetQuantity,
                BatchId = batch.Id,
                LotNo = batch.LotNo,
                BatchStatus = batch.Status,
                TargetQuantity = batch.TargetQuantity,
                ProducedQuantity = batch.ProducedQuantity
            });
        }

        return new FactorySimulationStatusDto
        {
            HasOpenSimulationLots = lines.Count > 0,
            OpenLotCount = lines.Count,
            OpenWorkOrderCount = openWoCount,
            Lines = lines
        };
    }

    private async Task<FactorySimulationLineDto?> FindOpenLineAsync(
        string stationId,
        CancellationToken cancellationToken)
    {
        var batch = await context.Batches
            .Where(item => item.Station == stationId
                && item.Status != BatchStatuses.Completed
                && item.ProducedQuantity < item.TargetQuantity)
            .OrderBy(item => item.Id)
            .FirstOrDefaultAsync(cancellationToken);

        if (batch is null) return null;

        WorkOrder? workOrder = null;
        if (batch.WorkOrderId is int workOrderId)
        {
            workOrder = await context.WorkOrders.FindAsync([workOrderId], cancellationToken);
        }

        workOrder ??= await context.WorkOrders
            .Where(order => order.Station == stationId && order.Status != WorkOrderStatuses.Completed)
            .OrderByDescending(order => order.Id)
            .FirstOrDefaultAsync(cancellationToken);

        if (workOrder is null)
        {
            return new FactorySimulationLineDto
            {
                StationId = stationId,
                BatchId = batch.Id,
                LotNo = batch.LotNo,
                Product = batch.Product,
                BatchStatus = batch.Status,
                TargetQuantity = batch.TargetQuantity,
                ProducedQuantity = batch.ProducedQuantity,
                PlannedQuantity = batch.TargetQuantity
            };
        }

        if (workOrder.Status == WorkOrderStatuses.Waiting)
        {
            workOrder.Status = WorkOrderStatuses.InProgress;
            await context.SaveChangesAsync(cancellationToken);
        }

        if (batch.WorkOrderId != workOrder.Id)
        {
            batch.WorkOrderId = workOrder.Id;
            batch.UpdatedAt = DateTimeOffset.UtcNow;
            await context.SaveChangesAsync(cancellationToken);
        }

        return ToLineDto(workOrder, batch);
    }

    private static List<string> ResolveStations(string[]? stationIds)
    {
        if (stationIds is { Length: > 0 })
        {
            return stationIds
                .Where(StationCatalog.IsProductionLine)
                .Distinct(StringComparer.Ordinal)
                .ToList();
        }

        return StationCatalog.ProductionLines.ToList();
    }

    private static FactorySimulationLineDto ToLineDto(WorkOrder workOrder, Batch batch) => new()
    {
        StationId = batch.Station,
        WorkOrderId = workOrder.Id,
        OrderNo = workOrder.OrderNo,
        Product = workOrder.Product,
        WorkOrderStatus = workOrder.Status,
        PlannedQuantity = workOrder.Quantity,
        BatchId = batch.Id,
        LotNo = batch.LotNo,
        BatchStatus = batch.Status,
        TargetQuantity = batch.TargetQuantity,
        ProducedQuantity = batch.ProducedQuantity
    };
}
