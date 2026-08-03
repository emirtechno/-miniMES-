using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using MiniMesApi.Models;

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
        public async Task<ActionResult<IEnumerable<WorkOrder>>> GetWorkOrders(
            [FromQuery] int limit = 100,
            CancellationToken cancellationToken = default)
        {
            limit = Math.Clamp(limit, 1, 500);

            return await _context.WorkOrders
                .AsNoTracking()
                .OrderByDescending(w => w.Id)
                .Take(limit)
                .ToListAsync(cancellationToken);
        }

        [HttpGet("{id:int}")]
        public async Task<ActionResult<WorkOrder>> GetWorkOrder(int id)
        {
            var workOrder = await _context.WorkOrders.AsNoTracking().FirstOrDefaultAsync(order => order.Id == id);
            return workOrder is null ? NotFound() : Ok(workOrder);
        }

        [HttpPost]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<WorkOrder>> CreateWorkOrder([FromBody] WorkOrder workOrder)
        {
            if (string.IsNullOrWhiteSpace(workOrder.OrderNo) ||
                string.IsNullOrWhiteSpace(workOrder.Product) ||
                string.IsNullOrWhiteSpace(workOrder.Station) ||
                workOrder.Quantity <= 0)
            {
                return BadRequest(new { message = "İş emri numarası, ürün, istasyon ve pozitif miktar zorunludur." });
            }

            var exists = await _context.WorkOrders.AnyAsync(order => order.OrderNo == workOrder.OrderNo);
            if (exists)
            {
                return Conflict(new { message = "Bu iş emri numarası zaten kullanılıyor." });
            }

            workOrder.Status = "Bekliyor";
            _context.WorkOrders.Add(workOrder);

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException)
            {
                return Conflict(new { message = "Bu iş emri numarası zaten kullanılıyor." });
            }

            return CreatedAtAction(nameof(GetWorkOrder), new { id = workOrder.Id }, workOrder);
        }

        [HttpPut("{id}/advance")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> AdvanceWorkOrder(int id)
        {
            var order = await _context.WorkOrders.FindAsync(id);
            if (order == null) return NotFound();

            if (order.Status == "Bekliyor") order.Status = "Devam Ediyor";
            else if (order.Status == "Devam Ediyor") order.Status = "Tamamlandı";
            else if (order.Status == "Tamamlandı") return Conflict(new { message = "Tamamlanmış iş emri ilerletilemez." });
            else return Conflict(new { message = "İş emri durumu geçersiz." });

            await _context.SaveChangesAsync();
            return Ok(order);
        }
    }
}
