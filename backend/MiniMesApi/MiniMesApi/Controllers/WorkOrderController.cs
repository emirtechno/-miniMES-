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
    // NEDEN: İş emri CRUD + durum geçişleri (advance/archive) + soft-delete (DeletedAt).
    // scope=active|history|all; RowVersion ile iyimser eşzamanlılık; lot/batch yok — yalnızca WO.
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
            [FromQuery] string scope = "active",
            CancellationToken cancellationToken = default)
        {
            limit = Math.Clamp(limit, 1, 200);
            if (!CursorCodec.TryDecodeId(cursor, out var cursorId))
            {
                return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Geçersiz sayfalama imleci.");
            }

            var normalizedScope = (scope ?? "active").Trim().ToLowerInvariant();
            if (normalizedScope is not ("active" or "history" or "all"))
            {
                return Problem(
                    statusCode: StatusCodes.Status400BadRequest,
                    title: "Geçersiz scope. active, history veya all kullanın.");
            }

            // NEDEN: Soft-delete satırlar listelenmez. scope: active=Arşivlendi hariç, history=yalnız Arşivlendi, all=hepsi.
            IQueryable<WorkOrder> query = _context.WorkOrders
                .AsNoTracking()
                .Where(order => order.DeletedAt == null);

            query = normalizedScope switch
            {
                "history" => query.Where(order => order.Status == WorkOrderStatuses.Archived),
                "all" => query,
                _ => query.Where(order => order.Status != WorkOrderStatuses.Archived)
            };

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
                .FirstOrDefaultAsync(order => order.Id == id && order.DeletedAt == null, cancellationToken);

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

            return CreatedAtAction(nameof(GetWorkOrder), new { id = workOrder.Id }, ToDto(workOrder));
        }

        // NEDEN: Bekliyor→Devam Ediyor→Tamamlandı→Arşivlendi tek adım; RowVersion zorunlu.
        [HttpPut("{id}/advance")]
        [Authorize(Policy = PolicyNames.WorkOrderManage)]
        public async Task<IActionResult> AdvanceWorkOrder(
            int id,
            AdvanceWorkOrderDto request,
            CancellationToken cancellationToken)
        {
            return await MutateWorkOrderStatusAsync(
                id,
                request,
                WorkOrderStatuses.TryAdvance,
                cancellationToken);
        }

        // NEDEN: Arşivlendi → Tamamlandı (geçmişten geri alma). Soft-delete restore ayrı endpoint.
        [HttpPut("{id}/restore")]
        [Authorize(Policy = PolicyNames.WorkOrderManage)]
        public async Task<IActionResult> RestoreWorkOrder(
            int id,
            AdvanceWorkOrderDto request,
            CancellationToken cancellationToken)
        {
            return await MutateWorkOrderStatusAsync(
                id,
                request,
                WorkOrderStatuses.TryRestore,
                cancellationToken);
        }

        // NEDEN: Hard-delete yok — DeletedAt damgası (soft-delete). Satır DB'de kalır, listelerden düşer.
        // NASIL: DELETE → DeletedAt=UtcNow; restore-deleted → DeletedAt=null. Status değişmez.
        [HttpDelete("{id:int}")]
        [Authorize(Policy = PolicyNames.WorkOrderManage)]
        public async Task<IActionResult> SoftDeleteWorkOrder(
            int id,
            [FromBody] AdvanceWorkOrderDto request,
            CancellationToken cancellationToken)
        {
            return await MutateSoftDeleteAsync(
                id,
                request,
                softDelete: true,
                cancellationToken);
        }

        [HttpPut("{id}/restore-deleted")]
        [Authorize(Policy = PolicyNames.WorkOrderManage)]
        public async Task<IActionResult> RestoreDeletedWorkOrder(
            int id,
            [FromBody] AdvanceWorkOrderDto request,
            CancellationToken cancellationToken)
        {
            return await MutateSoftDeleteAsync(
                id,
                request,
                softDelete: false,
                cancellationToken);
        }

        private async Task<IActionResult> MutateSoftDeleteAsync(
            int id,
            AdvanceWorkOrderDto request,
            bool softDelete,
            CancellationToken cancellationToken)
        {
            if (!TryParseRowVersion(request.RowVersion, out var rowVersion, out var parseError))
            {
                return parseError!;
            }

            var order = await _context.WorkOrders.FindAsync([id], cancellationToken);
            if (order == null) return NotFound();
            _context.Entry(order).Property(item => item.RowVersion).OriginalValue = rowVersion;

            if (softDelete)
            {
                if (order.DeletedAt is not null)
                {
                    return Problem(statusCode: StatusCodes.Status409Conflict, title: "İş emri zaten silinmiş.");
                }

                order.DeletedAt = DateTimeOffset.UtcNow;
            }
            else
            {
                if (order.DeletedAt is null)
                {
                    return Problem(statusCode: StatusCodes.Status409Conflict, title: "İş emri silinmemiş.");
                }

                order.DeletedAt = null;
            }

            return await SaveWithConcurrencyAsync(id, order, cancellationToken);
        }

        private async Task<IActionResult> MutateWorkOrderStatusAsync(
            int id,
            AdvanceWorkOrderDto request,
            TryChangeStatus tryChange,
            CancellationToken cancellationToken)
        {
            if (!TryParseRowVersion(request.RowVersion, out var rowVersion, out var parseError))
            {
                return parseError!;
            }

            var order = await _context.WorkOrders.FindAsync([id], cancellationToken);
            if (order == null) return NotFound();
            _context.Entry(order).Property(item => item.RowVersion).OriginalValue = rowVersion;

            // NEDEN: Silinmiş WO advance/restore edilemez — önce restore-deleted gerekir.
            if (order.DeletedAt is not null)
            {
                return Problem(statusCode: StatusCodes.Status409Conflict, title: "Silinmiş iş emri güncellenemez.");
            }

            if (!tryChange(order.Status, out var nextStatus, out var changeError))
            {
                return Problem(statusCode: StatusCodes.Status409Conflict, title: changeError);
            }

            order.Status = nextStatus;

            return await SaveWithConcurrencyAsync(id, order, cancellationToken);
        }

        private async Task<IActionResult> SaveWithConcurrencyAsync(
            int id,
            WorkOrder order,
            CancellationToken cancellationToken)
        {
            try
            {
                await _context.SaveChangesAsync(cancellationToken);
                return Ok(ToDto(order));
            }
            catch (DbUpdateConcurrencyException)
            {
                // NEDEN: Başka kullanıcı/sim aynı anda güncellediyse 409 + güncel DTO döner (UI yenileyip tekrar dener).
                var current = await _context.WorkOrders
                    .AsNoTracking()
                    .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
                var problem = new ProblemDetails
                {
                    Status = StatusCodes.Status409Conflict,
                    Title = "İş emri başka bir kullanıcı tarafından güncellendi.",
                    Detail = "Güncel veriyi yükleyip işlemi yeniden deneyin."
                };
                problem.Extensions["current"] = current is null || current.DeletedAt is not null
                    ? null
                    : ToDto(current);
                return Conflict(problem);
            }
        }

        private bool TryParseRowVersion(string rowVersionBase64, out byte[] rowVersion, out IActionResult? error)
        {
            try
            {
                rowVersion = Convert.FromBase64String(rowVersionBase64);
                error = null;
                return true;
            }
            catch (FormatException)
            {
                rowVersion = [];
                error = Problem(statusCode: StatusCodes.Status400BadRequest, title: "Geçersiz satır sürümü.");
                return false;
            }
        }

        private delegate bool TryChangeStatus(string currentStatus, out string nextStatus, out string? error);

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
                RowVersion = Convert.ToBase64String(order.RowVersion)
            };
        }
    }
}
