using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MiniMesApi.DTOs;
using MiniMesApi.Infrastructure;
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
        public async Task<ActionResult<CursorPage<MachineMetricDto>>> GetMetrics(
            [FromQuery] int limit = 50,
            [FromQuery] string? cursor = null,
            [FromQuery] string? stationId = null,
            CancellationToken cancellationToken = default)
        {
            limit = Math.Clamp(limit, 1, 200);
            if (!CursorCodec.TryDecodeTimestamp(cursor, out var cursorTime, out var cursorId))
            {
                return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Geçersiz sayfalama imleci.");
            }
            if (!string.IsNullOrWhiteSpace(stationId) && !StationCatalog.Contains(stationId))
            {
                return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Geçersiz istasyon kimliği.");
            }

            var query = _context.MachineMetrics.AsNoTracking();
            if (!string.IsNullOrWhiteSpace(stationId))
            {
                query = query.Where(metric => metric.StationId == stationId);
            }
            if (!string.IsNullOrWhiteSpace(cursor))
            {
                query = query.Where(metric =>
                    metric.RecordedAt < cursorTime ||
                    (metric.RecordedAt == cursorTime && metric.Id < cursorId));
            }

            var metrics = await query
                .OrderByDescending(m => m.RecordedAt)
                .ThenByDescending(m => m.Id)
                .Take(limit + 1)
                .ToListAsync(cancellationToken);

            var items = metrics.Take(limit).Select(metric => new MachineMetricDto
            {
                Id = metric.Id,
                StationId = metric.StationId,
                PlannedProductionSeconds = metric.PlannedProductionSeconds,
                DowntimeSeconds = metric.DowntimeSeconds,
                DowntimeReasonCode = metric.DowntimeReasonCode,
                DowntimeReason = DowntimeReasonCatalog.DisplayName(metric.DowntimeReasonCode),
                ShiftCode = metric.ShiftCode,
                ShiftName = ShiftCatalog.DisplayName(metric.ShiftCode),
                IdealCycleTimeSeconds = metric.IdealCycleTimeSeconds,
                ActualProductionCount = metric.ActualProductionCount,
                GoodProductionCount = metric.GoodProductionCount,
                RecordedAt = metric.RecordedAt
            }).ToArray();

            return Ok(new CursorPage<MachineMetricDto>
            {
                Items = items,
                NextCursor = metrics.Count > limit && items.Length > 0
                    ? CursorCodec.EncodeTimestamp(items[^1].RecordedAt, items[^1].Id)
                    : null
            });
        }
    }
}