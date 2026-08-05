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

        IQueryable<Batch> query = _context.Batches
            .AsNoTracking()
            .Include(batch => batch.WorkOrder);
        if (!string.IsNullOrWhiteSpace(cursor))
        {
            query = query.Where(batch => batch.Id < cursorId);
        }

        var batches = await query
            .OrderByDescending(batch => batch.Id)
            .Take(limit + 1)
            .ToListAsync(cancellationToken);

        var pageBatches = batches.Take(limit).ToList();
        var items = pageBatches.Select(ToDto).ToArray();
        return Ok(new CursorPage<BatchDto>
        {
            Items = items,
            NextCursor = batches.Count > limit && items.Length > 0
                ? CursorCodec.EncodeId(items[^1].Id)
                : null
        });
    }

    [HttpPost("{id:int}/advance")]
    [Authorize(Policy = PolicyNames.WorkOrderManage)]
    public async Task<ActionResult<BatchDto>> AdvanceBatch(int id, CancellationToken cancellationToken)
    {
        var batch = await _context.Batches
            .Include(item => item.WorkOrder)
            .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (batch is null)
        {
            return NotFound();
        }

        return Ok(ToDto(batch));
    }

    [HttpPost("{id:int}/reopen")]
    [Authorize(Policy = PolicyNames.WorkOrderManage)]
    public async Task<ActionResult<BatchDto>> ReopenBatch(int id, CancellationToken cancellationToken)
    {
        var batch = await _context.Batches
            .Include(item => item.WorkOrder)
            .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (batch is null)
        {
            return NotFound();
        }

        if (!BatchStatuses.TryReopen(batch.Status, out var nextStatus, out var error))
        {
            return Problem(statusCode: StatusCodes.Status409Conflict, title: error);
        }

        batch.Status = nextStatus;
        batch.UpdatedAt = DateTimeOffset.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);
        return Ok(ToDto(batch));
    }

    [HttpPut("{id:int}/progress")]
    [Authorize(Policy = PolicyNames.ProductionWrite)]
    public async Task<ActionResult<BatchDto>> UpdateProgress(
        int id,
        [FromBody] UpdateBatchProgressDto request,
        CancellationToken cancellationToken)
    {
        var batch = await _context.Batches
            .Include(item => item.WorkOrder)
            .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
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

        return Ok(ToDto(batch));
    }

    private static BatchDto ToDto(Batch batch)
    {
        var target = Math.Max(batch.TargetQuantity, 1);
        var produced = Math.Max(batch.ProducedQuantity, 0);
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
            WorkOrderNo = batch.WorkOrder?.OrderNo,
            UpdatedAt = batch.UpdatedAt
        };
    }
}
