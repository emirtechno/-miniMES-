using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using MiniMesApi.DTOs;
using MiniMesApi.Infrastructure;
using MiniMesApi.Models;

namespace MiniMesApi.Controllers
{
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

        // GET: api/Batch
        [HttpGet]
        public async Task<ActionResult<CursorPage<Batch>>> GetBatches(
            [FromQuery] int limit = 50,
            [FromQuery] string? cursor = null,
            CancellationToken cancellationToken = default)
        {
            limit = Math.Clamp(limit, 1, 200);
            if (!CursorCodec.TryDecodeId(cursor, out var cursorId))
            {
                return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Geçersiz sayfalama imleci.");
            }

            var query = _context.Batches.AsNoTracking();
            if (!string.IsNullOrWhiteSpace(cursor))
            {
                query = query.Where(batch => batch.Id < cursorId);
            }

            var batches = await query
                .OrderByDescending(batch => batch.Id)
                .Take(limit + 1)
                .ToListAsync(cancellationToken);

            var items = batches.Take(limit).ToArray();
            return Ok(new CursorPage<Batch>
            {
                Items = items,
                NextCursor = batches.Count > limit && items.Length > 0
                    ? CursorCodec.EncodeId(items[^1].Id)
                    : null
            });
        }
    }
}
