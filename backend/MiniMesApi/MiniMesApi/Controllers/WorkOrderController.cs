using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using MiniMesApi.DTOs;
using MiniMesApi.Models;
using MiniMesApi.Security;

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
        public async Task<ActionResult<IEnumerable<WorkOrderDto>>> GetWorkOrders(
            [FromQuery] int limit = 100,
            CancellationToken cancellationToken = default)
        {
            limit = Math.Clamp(limit, 1, 500);

            return await _context.WorkOrders
                .AsNoTracking()
                .OrderByDescending(w => w.Id)
                .Take(limit)
                .Select(order => new WorkOrderDto
                {
                    Id = order.Id,
                    OrderNo = order.OrderNo,
                    Product = order.Product,
                    Station = order.Station,
                    Quantity = order.Quantity,
                    Status = order.Status
                })
                .ToListAsync(cancellationToken);
        }

        [HttpGet("{id:int}")]
        public async Task<ActionResult<WorkOrderDto>> GetWorkOrder(int id)
        {
            var workOrder = await _context.WorkOrders.AsNoTracking().FirstOrDefaultAsync(order => order.Id == id);
            return workOrder is null ? NotFound() : Ok(ToDto(workOrder));
        }

        [HttpPost]
        [Authorize(Policy = PolicyNames.WorkOrderManage)]
        public async Task<ActionResult<WorkOrderDto>> CreateWorkOrder([FromBody] CreateWorkOrderDto request)
        {
            var exists = await _context.WorkOrders.AnyAsync(order => order.OrderNo == request.OrderNo);
            if (exists)
            {
                return Problem(
                    statusCode: StatusCodes.Status409Conflict,
                    title: "İş emri numarası zaten kullanılıyor.");
            }

            var workOrder = new WorkOrder
            {
                OrderNo = request.OrderNo,
                Product = request.Product,
                Station = request.Station,
                Quantity = request.Quantity,
                Status = "Bekliyor"
            };
            _context.WorkOrders.Add(workOrder);

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException)
            {
                return Problem(
                    statusCode: StatusCodes.Status409Conflict,
                    title: "İş emri numarası zaten kullanılıyor.");
            }

            return CreatedAtAction(nameof(GetWorkOrder), new { id = workOrder.Id }, ToDto(workOrder));
        }

        [HttpPut("{id}/advance")]
        [Authorize(Policy = PolicyNames.WorkOrderManage)]
        public async Task<IActionResult> AdvanceWorkOrder(int id)
        {
            var order = await _context.WorkOrders.FindAsync(id);
            if (order == null) return NotFound();

            if (order.Status == "Bekliyor") order.Status = "Devam Ediyor";
            else if (order.Status == "Devam Ediyor") order.Status = "Tamamlandı";
            else if (order.Status == "Tamamlandı")
                return Problem(statusCode: StatusCodes.Status409Conflict, title: "Tamamlanmış iş emri ilerletilemez.");
            else
                return Problem(statusCode: StatusCodes.Status409Conflict, title: "İş emri durumu geçersiz.");

            await _context.SaveChangesAsync();
            return Ok(ToDto(order));
        }

        private static WorkOrderDto ToDto(WorkOrder order)
        {
            return new WorkOrderDto
            {
                Id = order.Id,
                OrderNo = order.OrderNo,
                Product = order.Product,
                Station = order.Station,
                Quantity = order.Quantity,
                Status = order.Status
            };
        }
    }
}
