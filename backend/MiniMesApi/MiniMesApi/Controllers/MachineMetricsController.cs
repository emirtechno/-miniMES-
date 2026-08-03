using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MiniMesApi.Models;
using MiniMesApi.Security;

namespace MiniMesApi.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Policy = PolicyNames.MetricsRead)]
    public class MachineMetricsController : ControllerBase
    {
        private readonly MesDbContext _context;

        public MachineMetricsController(MesDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetMetrics(
            [FromQuery] int limit = 50,
            CancellationToken cancellationToken = default)
        {
            limit = Math.Clamp(limit, 1, 500);

            var metrics = await _context.MachineMetrics
                .AsNoTracking()
                .OrderByDescending(m => m.RecordedAt)
                .Take(limit)
                .ToListAsync(cancellationToken);

            return Ok(metrics);
        }
    }
}