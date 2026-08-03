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

        public MachineMetricsController(
            MesDbContext context,
            IValidator<CreateMachineMetricDto> validator,
            IMesRealtimePublisher realtime,
            ILotTelemetrySync lotSync)
        {
            _context = context;
            _validator = validator;
            _realtime = realtime;
            _lotSync = lotSync;
        }

        /// <summary>
        /// Plant / station KPI summary aggregated from MachineMetrics (SSOT).
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

            // Cap aggregation window to recent telemetry to keep summaries responsive.
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
