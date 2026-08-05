using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using MiniMesApi.DTOs;
using MiniMesApi.Infrastructure;
using MiniMesApi.Models;
using MiniMesApi.Security;
using MiniMesApi.Services;

namespace MiniMesApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class WorkOrderController : ControllerBase
    {
        private readonly MesDbContext _context;

        public WorkOrderController(MesDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<CursorPage<WorkOrderDto>>> GetWorkOrders(
            [FromQuery] int limit = 50,
            [FromQuery] string? cursor = null,
            CancellationToken cancellationToken = default)
        {
            limit = Math.Clamp(limit, 1, 200);
            if (!CursorCodec.TryDecodeId(cursor, out var cursorId))
            {
                return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Geçersiz sayfalama imleci.");
            }

            IQueryable<WorkOrder> query = _context.WorkOrders
                .AsNoTracking()
                .Include(order => order.Lots);
            if (!string.IsNullOrWhiteSpace(cursor))
            {
                query = query.Where(order => order.Id < cursorId);
            }

            var orders = await query
                .OrderByDescending(w => w.Id)
                .Take(limit + 1)
                .ToListAsync(cancellationToken);
            var items = orders.Take(limit).Select(ToDto).ToArray();

            return Ok(new CursorPage<WorkOrderDto>
            {
                Items = items,
                NextCursor = orders.Count > limit && items.Length > 0
                    ? CursorCodec.EncodeId(items[^1].Id)
                    : null
            });
        }

        [HttpGet("{id:int}")]
        public async Task<ActionResult<WorkOrderDto>> GetWorkOrder(
            int id,
            CancellationToken cancellationToken)
        {
            var workOrder = await _context.WorkOrders
                .AsNoTracking()
                .Include(order => order.Lots)
                .FirstOrDefaultAsync(order => order.Id == id, cancellationToken);
            return workOrder is null ? NotFound() : Ok(ToDto(workOrder));
        }

        [HttpPost]
        [Authorize(Policy = PolicyNames.WorkOrderManage)]
        public async Task<ActionResult<WorkOrderDto>> CreateWorkOrder(
            [FromBody] CreateWorkOrderDto request,
            CancellationToken cancellationToken)
        {
            if (!StationCatalog.Contains(request.Station))
            {
                return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Geçersiz istasyon kimliği.");
            }

            var exists = await _context.WorkOrders
                .AnyAsync(order => order.OrderNo == request.OrderNo, cancellationToken);
            if (exists)
            {
                return Problem(
                    statusCode: StatusCodes.Status409Conflict,
                    title: "İş emri numarası zaten kullanılıyor.");
            }

            var productId = await ProductCatalogResolver.ResolveProductIdAsync(
                _context,
                request.Product,
                cancellationToken);

            var workOrder = new WorkOrder
            {
                OrderNo = request.OrderNo,
                Product = request.Product,
                ProductId = productId,
                Station = request.Station,
                Quantity = request.Quantity,
                CompletedQuantity = 0,
                Status = WorkOrderStatuses.Waiting
            };
            _context.WorkOrders.Add(workOrder);

            if (request.CreateInitialLot)
            {
                var lotTarget = request.LotTargetQuantity ?? Math.Max(request.Quantity, 500);
                workOrder.Lots.Add(new Batch
                {
                    LotNo = $"LOT-{request.OrderNo}",
                    Product = request.Product,
                    ProductId = productId,
                    Station = request.Station,
                    Status = BatchStatuses.Waiting,
                    TargetQuantity = lotTarget,
                    ProducedQuantity = 0,
                    UpdatedAt = DateTimeOffset.UtcNow
                });
            }

            try
            {
                await _context.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateException)
            {
                return Problem(
                    statusCode: StatusCodes.Status409Conflict,
                    title: "İş emri numarası zaten kullanılıyor.");
            }

            await _context.Entry(workOrder).Collection(order => order.Lots).LoadAsync(cancellationToken);
            return CreatedAtAction(nameof(GetWorkOrder), new { id = workOrder.Id }, ToDto(workOrder));
        }

        [HttpPut("{id}/advance")]
        [Authorize(Policy = PolicyNames.WorkOrderManage)]
        public async Task<IActionResult> AdvanceWorkOrder(
            int id,
            AdvanceWorkOrderDto request,
            CancellationToken cancellationToken)
        {
            byte[] rowVersion;
            try
            {
                rowVersion = Convert.FromBase64String(request.RowVersion);
            }
            catch (FormatException)
            {
                return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Geçersiz satır sürümü.");
            }

            var order = await _context.WorkOrders.FindAsync([id], cancellationToken);
            if (order == null) return NotFound();
            _context.Entry(order).Property(item => item.RowVersion).OriginalValue = rowVersion;

            if (!WorkOrderStatuses.TryAdvance(order.Status, out var nextStatus, out var advanceError))
            {
                return Problem(statusCode: StatusCodes.Status409Conflict, title: advanceError);
            }

            order.Status = nextStatus;

            try
            {
                await _context.SaveChangesAsync(cancellationToken);
                return Ok(ToDto(order));
            }
            catch (DbUpdateConcurrencyException)
            {
                var current = await _context.WorkOrders
                    .AsNoTracking()
                    .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
                var problem = new ProblemDetails
                {
                    Status = StatusCodes.Status409Conflict,
                    Title = "İş emri başka bir kullanıcı tarafından güncellendi.",
                    Detail = "Güncel veriyi yükleyip işlemi yeniden deneyin."
                };
                problem.Extensions["current"] = current is null ? null : ToDto(current);
                return Conflict(problem);
            }
        }

        private static WorkOrderDto ToDto(WorkOrder order)
        {
            var completed = Math.Clamp(order.CompletedQuantity, 0, Math.Max(order.Quantity, 0));
            var target = Math.Max(order.Quantity, 1);
            return new WorkOrderDto
            {
                Id = order.Id,
                OrderNo = order.OrderNo,
                Product = order.Product,
                Station = order.Station,
                Quantity = order.Quantity,
                CompletedQuantity = completed,
                ProgressPercent = Math.Round(Math.Min(100d, completed * 100d / target), 1),
                Status = order.Status,
                RowVersion = Convert.ToBase64String(order.RowVersion),
                Lots = (order.Lots ?? [])
                    .OrderBy(lot => lot.Id)
                    .Select(lot => new WorkOrderLotSummaryDto
                    {
                        Id = lot.Id,
                        LotNo = lot.LotNo,
                        Status = lot.Status,
                        TargetQuantity = lot.TargetQuantity,
                        ProducedQuantity = lot.ProducedQuantity
                    })
                    .ToArray()
            };
        }
    }
}
