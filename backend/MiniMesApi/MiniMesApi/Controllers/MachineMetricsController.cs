using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MiniMesApi.Models;

namespace MiniMesApi.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class MachineMetricsController : ControllerBase
    {
        private readonly MesDbContext _context;

        public MachineMetricsController(MesDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetMetrics()
        {
            var metrics = await _context.MachineMetrics
                .OrderByDescending(m => m.RecordedAt)
                .Take(50) // Son 50 log
                .ToListAsync();

            return Ok(metrics);
        }
    }
}