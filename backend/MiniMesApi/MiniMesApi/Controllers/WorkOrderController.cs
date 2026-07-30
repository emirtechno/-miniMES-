using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MiniMesApi.Models;

namespace MiniMesApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class WorkOrderController : ControllerBase
    {
        private readonly MesDbContext _context;

        public WorkOrderController(MesDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<WorkOrder>>> GetWorkOrders()
        {
            return await _context.WorkOrders.AsNoTracking().OrderByDescending(w => w.Id).ToListAsync();
        }

        [HttpPost]
        public async Task<ActionResult<WorkOrder>> CreateWorkOrder([FromBody] WorkOrder workOrder)
        {
            workOrder.Status = "Bekliyor";
            _context.WorkOrders.Add(workOrder);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetWorkOrders), new { id = workOrder.Id }, workOrder);
        }

        [HttpPut("{id}/advance")]
        public async Task<IActionResult> AdvanceWorkOrder(int id)
        {
            var order = await _context.WorkOrders.FindAsync(id);
            if (order == null) return NotFound();

            if (order.Status == "Bekliyor") order.Status = "Devam Ediyor";
            else if (order.Status == "Devam Ediyor") order.Status = "Tamamlandı";

            await _context.SaveChangesAsync();
            return NoContent();
        }
    }
}