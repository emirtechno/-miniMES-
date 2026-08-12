using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MiniMesApi.DTOs;
using MiniMesApi.Infrastructure;
using MiniMesApi.Models;
using MiniMesApi.Security;
using MiniMesApi.Services;

namespace MiniMesApi.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Policy = PolicyNames.MetricsRead)]
    public class MachineMetricsController : ControllerBase
    {
        private readonly MesDbContext _context;
        private readonly IMetricIngestService _ingest;
        private readonly IAuditLogService _auditLog;
        private readonly ILogger<MachineMetricsController> _logger;

        public MachineMetricsController(
            MesDbContext context,
            IMetricIngestService ingest,
            IAuditLogService auditLog,
            ILogger<MachineMetricsController> logger)
        {
            _context = context;
            _ingest = ingest;
            _auditLog = auditLog;
            _logger = logger;
        }

        /// <summary>
        /// Fabrika / istasyon KPI özeti — MachineMetrics'ten toplanır (SSOT).
        /// </summary>
        [HttpGet("summary")]
        public async Task<ActionResult<IReadOnlyList<TelemetrySummaryDto>>> GetSummary(
            [FromQuery] string? stationId = null,
            CancellationToken cancellationToken = default)
        {
            if (!string.IsNullOrWhiteSpace(stationId) && !StationCatalog.Contains(stationId))
            {
                return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Geçersiz istasyon kimliği.");
            }

            var query = _context.MachineMetrics.AsNoTracking();
            if (!string.IsNullOrWhiteSpace(stationId))
            {
                query = query.Where(metric => metric.StationId == stationId);
            }

            // Özetleri hızlı tutmak için toplama penceresini son telemetriyle sınırla.
            var metrics = await query
                .OrderByDescending(metric => metric.RecordedAt)
                .Take(string.IsNullOrWhiteSpace(stationId) ? 2000 : 500)
                .ToListAsync(cancellationToken);

            if (!string.IsNullOrWhiteSpace(stationId))
            {
                return Ok(new[] { TelemetryAggregator.Aggregate(metrics, stationId) });
            }

            var byStation = TelemetryAggregator.AggregateByStation(metrics);
            var plant = TelemetryAggregator.Aggregate(metrics, null);
            var result = new List<TelemetrySummaryDto> { plant };
            result.AddRange(StationCatalog.All.Select(id =>
                byStation.TryGetValue(id, out var summary)
                    ? summary
                    : TelemetryAggregator.Aggregate(Array.Empty<MachineMetric>(), id)));
            return Ok(result);
        }

        [HttpGet]
        public async Task<ActionResult<CursorPage<MachineMetricDto>>> GetMetrics(
            [FromQuery] int limit = 50,
            [FromQuery] string? cursor = null,
            [FromQuery] string? stationId = null,
            [FromQuery] DateTimeOffset? from = null,
            [FromQuery] DateTimeOffset? to = null,
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
            if (from is not null && to is not null && from > to)
            {
                return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Geçersiz zaman aralığı (from > to).");
            }

            var query = _context.MachineMetrics.AsNoTracking();
            if (!string.IsNullOrWhiteSpace(stationId))
            {
                query = query.Where(metric => metric.StationId == stationId);
            }
            if (from is not null)
            {
                query = query.Where(metric => metric.RecordedAt >= from);
            }
            if (to is not null)
            {
                query = query.Where(metric => metric.RecordedAt <= to);
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

            var items = metrics.Take(limit).Select(MetricIngestService.ToDto).ToArray();

            return Ok(new CursorPage<MachineMetricDto>
            {
                Items = items,
                NextCursor = metrics.Count > limit && items.Length > 0
                    ? CursorCodec.EncodeTimestamp(items[^1].RecordedAt, items[^1].Id)
                    : null
            });
        }

        /// <summary>
        /// PLC ingest — yalnızca ekleme (append-only) MachineMetrics satırı (uygulama SSOT yazım yolu).
        /// </summary>
        [HttpPost]
        [Authorize(Policy = PolicyNames.ProductionWrite)]
        public async Task<ActionResult<MachineMetricDto>> IngestMetric(
            [FromBody] CreateMachineMetricDto dto,
            CancellationToken cancellationToken)
        {
            try
            {
                var result = await _ingest.IngestAsync(dto, cancellationToken);
                return CreatedAtAction(nameof(GetMetrics), new { stationId = result.StationId }, result);
            }
            catch (MetricIngestValidationException ex)
            {
                return BadRequest(new ValidationProblemDetails(ex.Errors));
            }
        }

        /// <summary>
        /// Operatör fire kaydı — ScrapLog + MachineMetrics tick (Actual=adet, Good=0). WO iyi adedini ilerletmez.
        /// </summary>
        [HttpPost("scrap")]
        [Authorize(Policy = PolicyNames.ProductionWrite)]
        public async Task<ActionResult<ScrapLogDto>> LogScrap(
            [FromBody] CreateScrapDto request,
            CancellationToken cancellationToken)
        {
            if (request.Quantity <= 0)
            {
                return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Fire miktarı 0'dan büyük olmalıdır.");
            }

            if (!StationCatalog.Contains(request.StationId))
            {
                return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Geçersiz istasyon kimliği.");
            }

            if (request.WorkOrderId is int workOrderId)
            {
                var woExists = await _context.WorkOrders.AsNoTracking()
                    .AnyAsync(order => order.Id == workOrderId && order.DeletedAt == null, cancellationToken);
                if (!woExists)
                {
                    return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Geçersiz iş emri.");
                }
            }

            var operatorId = User.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? User.Identity?.Name
                ?? "unknown";

            var shiftSessionId = request.ShiftSessionId;
            if (shiftSessionId is null)
            {
                shiftSessionId = await _context.ShiftSessions.AsNoTracking()
                    .Where(session => session.StationId == request.StationId
                        && session.Status != ShiftSessionStatuses.Ended)
                    .OrderByDescending(session => session.StartedAt)
                    .Select(session => (int?)session.Id)
                    .FirstOrDefaultAsync(cancellationToken);
            }

            MachineMetricDto metricDto;
            try
            {
                metricDto = await _ingest.IngestAsync(new CreateMachineMetricDto
                {
                    StationId = request.StationId,
                    PlannedProductionSeconds = 60,
                    DowntimeSeconds = 0,
                    DowntimeReasonCode = DowntimeReasonCatalog.None,
                    IdealCycleTimeSeconds = 2,
                    ActualProductionCount = request.Quantity,
                    GoodProductionCount = 0,
                    RecordedAt = DateTimeOffset.UtcNow
                }, cancellationToken);
            }
            catch (MetricIngestValidationException ex)
            {
                return BadRequest(new ValidationProblemDetails(ex.Errors));
            }

            // NEDEN: İstemci ShiftSessionId göndermediyse ingest'in çözdüğü oturum kimliğini kullan.
            shiftSessionId ??= metricDto.ShiftSessionId;

            var scrap = new ScrapLog
            {
                StationId = request.StationId,
                Quantity = request.Quantity,
                ReasonCode = string.IsNullOrWhiteSpace(request.ReasonCode) ? null : request.ReasonCode.Trim(),
                WorkOrderId = request.WorkOrderId,
                ShiftSessionId = shiftSessionId,
                OperatorUserId = operatorId,
                RecordedAt = DateTimeOffset.UtcNow,
                MachineMetricId = metricDto.Id
            };

            _context.ScrapLogs.Add(scrap);
            await _context.SaveChangesAsync(cancellationToken);

            await _auditLog.WriteAsync(
                AuditEntityTypes.ScrapLog,
                scrap.Id.ToString(),
                AuditActions.ScrapIngest,
                User,
                details: $"Station={scrap.StationId};Qty={scrap.Quantity};Reason={scrap.ReasonCode};Session={scrap.ShiftSessionId}",
                cancellationToken: cancellationToken);

            _logger.LogInformation(
                "Scrap ingested. ScrapLogId={ScrapLogId} StationId={StationId} Quantity={Quantity} ReasonCode={ReasonCode} OperatorUserId={OperatorUserId} WorkOrderId={WorkOrderId}",
                scrap.Id,
                scrap.StationId,
                scrap.Quantity,
                scrap.ReasonCode,
                scrap.OperatorUserId,
                scrap.WorkOrderId);

            return CreatedAtAction(nameof(GetMetrics), new { stationId = scrap.StationId }, new ScrapLogDto
            {
                Id = scrap.Id,
                StationId = scrap.StationId,
                Quantity = scrap.Quantity,
                ReasonCode = scrap.ReasonCode,
                WorkOrderId = scrap.WorkOrderId,
                ShiftSessionId = scrap.ShiftSessionId,
                OperatorUserId = scrap.OperatorUserId,
                RecordedAt = scrap.RecordedAt,
                MachineMetricId = scrap.MachineMetricId,
                Metric = metricDto
            });
        }
    }
}
