using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MiniMesApi.DTOs;
using MiniMesApi.Infrastructure;
using MiniMesApi.Models;
using MiniMesApi.Security;

namespace MiniMesApi.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize]
public class BatchController : ControllerBase
{
    private readonly MesDbContext _context;

    public BatchController(MesDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<CursorPage<BatchDto>>> GetBatches(
        [FromQuery] int limit = 50,
        [FromQuery] string? cursor = null,
        CancellationToken cancellationToken = default)
    {
        limit = Math.Clamp(limit, 1, 200);
        if (!CursorCodec.TryDecodeId(cursor, out var cursorId))
        {
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Geçersiz sayfalama imleci.");
        }

        var query = _context.Batches.AsQueryable();
        if (!string.IsNullOrWhiteSpace(cursor))
        {
            query = query.Where(batch => batch.Id < cursorId);
        }

        var batches = await query
            .OrderByDescending(batch => batch.Id)
            .Take(limit + 1)
            .ToListAsync(cancellationToken);

        var pageBatches = batches.Take(limit).ToList();
        await SyncProducedFromTelemetryAsync(pageBatches, cancellationToken);

        var workOrderIds = pageBatches
            .Where(batch => batch.WorkOrderId.HasValue)
            .Select(batch => batch.WorkOrderId!.Value)
            .Distinct()
            .ToList();
        var orderNos = workOrderIds.Count == 0
            ? new Dictionary<int, string>()
            : await _context.WorkOrders.AsNoTracking()
                .Where(order => workOrderIds.Contains(order.Id))
                .ToDictionaryAsync(order => order.Id, order => order.OrderNo, cancellationToken);

        var items = pageBatches.Select(batch => ToDto(batch, orderNos)).ToArray();
        return Ok(new CursorPage<BatchDto>
        {
            Items = items,
            NextCursor = batches.Count > limit && items.Length > 0
                ? CursorCodec.EncodeId(items[^1].Id)
                : null
        });
    }

    /// <summary>
    /// Normalize lot status from stored ProducedQuantity (advanced by Live Stream ticks).
    /// Scales small demo targets so ~100–140 unit PLC ticks show meaningful progress.
    /// </summary>
    private async Task SyncProducedFromTelemetryAsync(List<Batch> batches, CancellationToken cancellationToken)
    {
        if (batches.Count == 0) return;

        var dirty = false;
        foreach (var batch in batches)
        {
            // Legacy seeds used Target≈50–200; industrial ticks are ~120 — raise target for open lots
            // that are not linked to a work order (sim lots keep their random planned qty).
            if (batch.Status != BatchStatuses.Completed
                && batch.WorkOrderId is null
                && batch.TargetQuantity > 0
                && batch.TargetQuantity < 500)
            {
                batch.TargetQuantity = 1000;
                dirty = true;
            }

            var produced = Math.Clamp(batch.ProducedQuantity, 0, Math.Max(batch.TargetQuantity, 0));
            var nextStatus = produced <= 0
                ? BatchStatuses.Waiting
                : produced >= batch.TargetQuantity
                    ? BatchStatuses.Completed
                    : BatchStatuses.InProgress;

            if (batch.ProducedQuantity != produced || batch.Status != nextStatus)
            {
                batch.ProducedQuantity = produced;
                batch.Status = nextStatus;
                batch.UpdatedAt = DateTimeOffset.UtcNow;
                dirty = true;
            }
            else if (dirty)
            {
                batch.UpdatedAt = DateTimeOffset.UtcNow;
            }
        }

        if (dirty)
        {
            await _context.SaveChangesAsync(cancellationToken);
        }
    }

    [HttpPost("{id:int}/advance")]
    [Authorize(Policy = PolicyNames.WorkOrderManage)]
    public async Task<ActionResult<BatchDto>> AdvanceBatch(int id, CancellationToken cancellationToken)
    {
        var batch = await _context.Batches.FindAsync([id], cancellationToken);
        if (batch is null)
        {
            return NotFound();
        }

        await SyncProducedFromTelemetryAsync([batch], cancellationToken);

        if (!BatchStatuses.TryAdvance(batch.Status, out var nextStatus, out var advanceError))
        {
            return Problem(statusCode: StatusCodes.Status409Conflict, title: advanceError);
        }

        batch.Status = nextStatus;
        batch.UpdatedAt = DateTimeOffset.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);
        return Ok(await ToDtoAsync(batch, cancellationToken));
    }

    [HttpPost("{id:int}/reopen")]
    [Authorize(Policy = PolicyNames.WorkOrderManage)]
    public async Task<ActionResult<BatchDto>> ReopenBatch(int id, CancellationToken cancellationToken)
    {
        var batch = await _context.Batches.FindAsync([id], cancellationToken);
        if (batch is null)
        {
            return NotFound();
        }

        if (!BatchStatuses.TryReopen(batch.Status, out var nextStatus, out var reopenError))
        {
            return Problem(statusCode: StatusCodes.Status409Conflict, title: reopenError);
        }

        batch.Status = nextStatus;
        // Keep produced quantity; reopen only unlocks status for further telemetry.
        if (batch.ProducedQuantity >= batch.TargetQuantity && batch.TargetQuantity > 0)
        {
            batch.ProducedQuantity = Math.Max(0, batch.TargetQuantity - 1);
        }

        batch.UpdatedAt = DateTimeOffset.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);
        return Ok(await ToDtoAsync(batch, cancellationToken));
    }

    [HttpPut("{id:int}/progress")]
    [Authorize(Policy = PolicyNames.ProductionWrite)]
    public async Task<ActionResult<BatchDto>> UpdateProgress(
        int id,
        [FromBody] UpdateBatchProgressDto request,
        CancellationToken cancellationToken)
    {
        var batch = await _context.Batches.FindAsync([id], cancellationToken);
        if (batch is null)
        {
            return NotFound();
        }

        // Target may still be adjusted by planners; produced always comes from telemetry.
        if (request.TargetQuantity is int target)
        {
            batch.TargetQuantity = target;
            batch.UpdatedAt = DateTimeOffset.UtcNow;
            await _context.SaveChangesAsync(cancellationToken);
        }

        await SyncProducedFromTelemetryAsync([batch], cancellationToken);
        return Ok(await ToDtoAsync(batch, cancellationToken));
    }

    private async Task<BatchDto> ToDtoAsync(Batch batch, CancellationToken cancellationToken)
    {
        string? orderNo = null;
        if (batch.WorkOrderId is int workOrderId)
        {
            orderNo = await _context.WorkOrders.AsNoTracking()
                .Where(order => order.Id == workOrderId)
                .Select(order => order.OrderNo)
                .FirstOrDefaultAsync(cancellationToken);
        }

        return ToDto(
            batch,
            orderNo is null
                ? new Dictionary<int, string>()
                : new Dictionary<int, string> { [batch.WorkOrderId!.Value] = orderNo });
    }

    private static BatchDto ToDto(Batch batch, IReadOnlyDictionary<int, string> orderNos)
    {
        var target = Math.Max(batch.TargetQuantity, 1);
        var produced = Math.Max(batch.ProducedQuantity, 0);
        string? workOrderNo = null;
        if (batch.WorkOrderId is int workOrderId)
        {
            orderNos.TryGetValue(workOrderId, out workOrderNo);
        }

        return new BatchDto
        {
            Id = batch.Id,
            LotNo = batch.LotNo,
            Product = batch.Product,
            Station = batch.Station,
            Status = batch.Status,
            TargetQuantity = batch.TargetQuantity,
            ProducedQuantity = batch.ProducedQuantity,
            ProgressPercent = Math.Round(Math.Min(100d, produced * 100d / target), 1),
            WorkOrderId = batch.WorkOrderId,
            WorkOrderNo = workOrderNo,
            UpdatedAt = batch.UpdatedAt
        };
    }
}
