using FluentValidation;
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
        private readonly IValidator<CreateMachineMetricDto> _validator;
        private readonly IMesRealtimePublisher _realtime;
        private readonly ILotTelemetrySync _lotSync;
        private readonly IAuditLogService _audit;

        public MachineMetricsController(
            MesDbContext context,
            IValidator<CreateMachineMetricDto> validator,
            IMesRealtimePublisher realtime,
            ILotTelemetrySync lotSync,
            IAuditLogService audit)
        {
            _context = context;
            _validator = validator;
            _realtime = realtime;
            _lotSync = lotSync;
            _audit = audit;
        }

        /// <summary>
        /// Plant / station KPI summary aggregated from MachineMetrics (SSOT).
        /// Optional shiftCode / since narrow the window in SQL (no in-memory Take cap).
        /// </summary>
        [HttpGet("summary")]
        public async Task<ActionResult<IReadOnlyList<TelemetrySummaryDto>>> GetSummary(
            [FromQuery] string? stationId = null,
            [FromQuery] string? shiftCode = null,
            [FromQuery] DateTimeOffset? since = null,
            CancellationToken cancellationToken = default)
        {
            if (!string.IsNullOrWhiteSpace(stationId) && !StationCatalog.Contains(stationId))
            {
                return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Geçersiz istasyon kimliği.");
            }

            if (!string.IsNullOrWhiteSpace(shiftCode) && !ShiftCatalog.Contains(shiftCode))
            {
                return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Geçersiz vardiya kodu.");
            }

            var query = _context.MachineMetrics.AsNoTracking();
            if (!string.IsNullOrWhiteSpace(stationId))
            {
                query = query.Where(metric => metric.StationId == stationId);
            }

            if (!string.IsNullOrWhiteSpace(shiftCode))
            {
                query = query.Where(metric => metric.ShiftCode == shiftCode);
            }

            if (since is DateTimeOffset sinceUtc)
            {
                query = query.Where(metric => metric.RecordedAt >= sinceUtc);
            }

            // SQL SUM/COUNT/MAX — avoid loading thousands of entities for dashboard KPIs.
            if (!string.IsNullOrWhiteSpace(stationId))
            {
                var hasRows = await query.AnyAsync(cancellationToken);
                if (!hasRows)
                {
                    return Ok(new[] { TelemetryAggregator.FromTotals(stationId, 0, 0, 0, 0, null) });
                }

                var actual = await query.SumAsync(metric => (long)metric.ActualProductionCount, cancellationToken);
                var good = await query.SumAsync(metric => (long)metric.GoodProductionCount, cancellationToken);
                var downtime = await query.SumAsync(metric => metric.DowntimeSeconds, cancellationToken);
                var tickCount = await query.CountAsync(cancellationToken);
                var lastRecordedAt = await query.MaxAsync(metric => metric.RecordedAt, cancellationToken);

                return Ok(new[]
                {
                    TelemetryAggregator.FromTotals(stationId, actual, good, downtime, tickCount, lastRecordedAt)
                });
            }

            var stationRows = await query
                .GroupBy(metric => metric.StationId)
                .Select(group => new
                {
                    StationId = group.Key,
                    Actual = group.Sum(metric => (long)metric.ActualProductionCount),
                    Good = group.Sum(metric => (long)metric.GoodProductionCount),
                    Downtime = group.Sum(metric => metric.DowntimeSeconds),
                    TickCount = group.Count(),
                    LastRecordedAt = (DateTimeOffset?)group.Max(metric => metric.RecordedAt)
                })
                .ToListAsync(cancellationToken);

            var byStation = stationRows.ToDictionary(
                row => row.StationId,
                row => TelemetryAggregator.FromTotals(
                    row.StationId,
                    row.Actual,
                    row.Good,
                    row.Downtime,
                    row.TickCount,
                    row.LastRecordedAt),
                StringComparer.Ordinal);

            var plantActual = stationRows.Sum(row => row.Actual);
            var plantGood = stationRows.Sum(row => row.Good);
            var plantDowntime = stationRows.Sum(row => row.Downtime);
            var plantTicks = stationRows.Sum(row => row.TickCount);
            DateTimeOffset? plantLast = stationRows.Count == 0
                ? null
                : stationRows.Max(row => row.LastRecordedAt);

            var result = new List<TelemetrySummaryDto>
            {
                TelemetryAggregator.FromTotals(null, plantActual, plantGood, plantDowntime, plantTicks, plantLast)
            };
            result.AddRange(StationCatalog.All.Select(id =>
                byStation.TryGetValue(id, out var summary)
                    ? summary
                    : TelemetryAggregator.FromTotals(id, 0, 0, 0, 0, null)));
            return Ok(result);
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

            var items = metrics.Take(limit).Select(ToDto).ToArray();

            return Ok(new CursorPage<MachineMetricDto>
            {
                Items = items,
                NextCursor = metrics.Count > limit && items.Length > 0
                    ? CursorCodec.EncodeTimestamp(items[^1].RecordedAt, items[^1].Id)
                    : null
            });
        }

        /// <summary>
        /// Live Stream / PLC ingest — append-only MachineMetrics row (application SSOT write path).
        /// </summary>
        [HttpPost]
        [Authorize(Policy = PolicyNames.ProductionWrite)]
        public async Task<ActionResult<MachineMetricDto>> IngestMetric(
            [FromBody] CreateMachineMetricDto dto,
            CancellationToken cancellationToken)
        {
            var validation = await _validator.ValidateAsync(dto, cancellationToken);
            if (!validation.IsValid)
            {
                return BadRequest(new ValidationProblemDetails(validation.Errors
                    .GroupBy(error => error.PropertyName)
                    .ToDictionary(
                        group => group.Key,
                        group => group.Select(error => error.ErrorMessage).ToArray())));
            }

            var recordedAt = dto.RecordedAt ?? DateTimeOffset.UtcNow;
            var metric = new MachineMetric
            {
                StationId = dto.StationId,
                PlannedProductionSeconds = dto.PlannedProductionSeconds,
                DowntimeSeconds = dto.DowntimeSeconds,
                DowntimeReasonCode = string.IsNullOrWhiteSpace(dto.DowntimeReasonCode)
                    ? DowntimeReasonCatalog.None
                    : dto.DowntimeReasonCode,
                ShiftCode = string.IsNullOrWhiteSpace(dto.ShiftCode)
                    ? ShiftCatalog.ResolveForUtc(recordedAt)
                    : dto.ShiftCode,
                IdealCycleTimeSeconds = dto.IdealCycleTimeSeconds,
                ActualProductionCount = dto.ActualProductionCount,
                GoodProductionCount = dto.GoodProductionCount,
                RecordedAt = recordedAt
            };
            MachineMetricInvariants.Normalize(metric);

            _context.MachineMetrics.Add(metric);
            await _context.SaveChangesAsync(cancellationToken);

            await _lotSync.ApplyGoodUnitsAsync(metric.StationId, metric.GoodProductionCount, cancellationToken);

            var oee = OeeCalculator.Calculate(metric);
            await _realtime.OeeUpdatedAsync([oee], cancellationToken);

            // Audit scrap / downtime mutations only — skip high-frequency Live Stream ticks.
            var isManualScrap = metric.ActualProductionCount > 0 && metric.GoodProductionCount == 0;
            var isDowntimeEvent = metric.DowntimeSeconds > 0
                && !string.Equals(metric.DowntimeReasonCode, DowntimeReasonCatalog.None, StringComparison.Ordinal);
            if (isManualScrap || isDowntimeEvent)
            {
                await _audit.WriteAsync(
                    AuditEntityTypes.MachineMetric,
                    metric.Id.ToString(),
                    isManualScrap ? AuditActions.ScrapIngest : AuditActions.DowntimeIngest,
                    User,
                    $"station={metric.StationId}; actual={metric.ActualProductionCount}; good={metric.GoodProductionCount}; downtime={metric.DowntimeSeconds}; reason={metric.DowntimeReasonCode}",
                    cancellationToken);
            }

            return CreatedAtAction(nameof(GetMetrics), new { stationId = metric.StationId }, ToDto(metric));
        }

        private static MachineMetricDto ToDto(MachineMetric metric) => new()
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
        };
    }
}
