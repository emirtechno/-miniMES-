using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using MiniMesApi.DTOs;
using MiniMesApi.Infrastructure;
using MiniMesApi.Security;
using MiniMesApi.Models;

using MiniMesApi.Services;

namespace MiniMesApi.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class AlarmController : ControllerBase
    {
        private readonly MesDbContext _context;
        private readonly ILogger<AlarmController> _logger;
        private readonly IMesRealtimePublisher _realtime;
        private readonly IStationRuntimeService _runtime;
        private readonly IDowntimeEventService _downtimeEvents;
        private readonly IAuditLogService _auditLog;

        public AlarmController(
            MesDbContext context,
            ILogger<AlarmController> logger,
            IMesRealtimePublisher realtime,
            IStationRuntimeService runtime,
            IDowntimeEventService downtimeEvents,
            IAuditLogService auditLog)
        {
            _context = context;
            _logger = logger;
            _realtime = realtime;
            _runtime = runtime;
            _downtimeEvents = downtimeEvents;
            _auditLog = auditLog;
        }

        [HttpGet]
        public async Task<ActionResult<CursorPage<AlarmDto>>> GetAlarms(
            [FromQuery] int limit = 50,
            [FromQuery] string? cursor = null,
            [FromQuery] string? status = null,
            [FromQuery] bool openOnly = false,
            CancellationToken cancellationToken = default)
        {
            limit = Math.Clamp(limit, 1, 200);
            if (!CursorCodec.TryDecodeTimestamp(cursor, out var cursorTime, out var cursorId))
            {
                return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Geçersiz sayfalama imleci.");
            }

            var query = _context.Alarms.AsNoTracking();
            if (openOnly)
            {
                // Onaylandı stays open until Çözüldü/Kapalı — acknowledge is awareness only.
                query = query.Where(alarm =>
                    alarm.Status != AlarmStatuses.Resolved
                    && alarm.Status != AlarmStatuses.ClosedLegacy);
            }
            else if (!string.IsNullOrWhiteSpace(status))
            {
                query = query.Where(alarm => alarm.Status == status);
            }

            if (!string.IsNullOrWhiteSpace(cursor))
            {
                query = query.Where(alarm =>
                    alarm.Time < cursorTime ||
                    (alarm.Time == cursorTime && alarm.Id < cursorId));
            }

            var alarms = await query
                .OrderByDescending(a => a.Time)
                .ThenByDescending(a => a.Id)
                .Take(limit + 1)
                .ToListAsync(cancellationToken);

            var items = alarms.Take(limit).Select(ToDto).ToArray();
            return Ok(new CursorPage<AlarmDto>
            {
                Items = items,
                NextCursor = alarms.Count > limit && items.Length > 0
                    ? CursorCodec.EncodeTimestamp(items[^1].Time, items[^1].Id)
                    : null
            });
        }

        [HttpGet("{id:int}")]
        public async Task<ActionResult<AlarmDto>> GetAlarmById(int id, CancellationToken cancellationToken)
        {
            var alarm = await _context.Alarms.AsNoTracking()
                .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
            if (alarm is null)
            {
                return Problem(statusCode: StatusCodes.Status404NotFound, title: "Alarm bulunamadı.");
            }

            return Ok(ToDto(alarm));
        }

        [HttpPost]
        [Authorize(Policy = PolicyNames.AlarmWrite)]
        public async Task<ActionResult<AlarmDto>> CreateAlarm(
            [FromBody] CreateAlarmDto request,
            CancellationToken cancellationToken)
        {
            if (!StationCatalog.Contains(request.Station))
            {
                return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Geçersiz istasyon kimliği.");
            }

            var alarm = new Alarm
            {
                Title = request.Title,
                Station = request.Station,
                Severity = request.Severity,
                Description = request.Description,
                Time = DateTimeOffset.UtcNow,
                Status = "Açık"
            };

            try
            {
                _context.Alarms.Add(alarm);
                await _context.SaveChangesAsync(cancellationToken);
                await _runtime.PauseForAlarmAsync(alarm.Station, alarm.Title, alarm.Severity, cancellationToken);
                var dto = ToDto(alarm);
                await _realtime.AlarmCreatedAsync(dto, cancellationToken);

                return CreatedAtAction(nameof(GetAlarmById), new { id = alarm.Id }, dto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Alarm oluşturulurken beklenmeyen hata oluştu.");
                return Problem(statusCode: StatusCodes.Status500InternalServerError, title: "Alarm oluşturulamadı.");
            }
        }

        /// <summary>
        /// Soft-resolve (product model): never hard-delete downtime records. DELETE maps to resolve.
        /// </summary>
        [HttpDelete("{id:int}")]
        [Authorize(Policy = PolicyNames.AlarmManage)]
        public Task<ActionResult<AlarmDto>> DeleteAlarm(int id, CancellationToken cancellationToken) =>
            ResolveAlarm(id, cancellationToken);

        [HttpPut("acknowledge/{id}")]
        [Authorize(Policy = PolicyNames.AlarmManage)]
        public async Task<ActionResult<AlarmDto>> AcknowledgeAlarm(int id, CancellationToken cancellationToken)
        {
            try
            {
                var alarm = await _context.Alarms.FindAsync([id], cancellationToken);
                if (alarm == null)
                {
                    return Problem(statusCode: StatusCodes.Status404NotFound, title: "Alarm bulunamadı.");
                }

                if (alarm.Status == "Çözüldü")
                {
                    return Problem(statusCode: StatusCodes.Status409Conflict, title: "Çözülmüş alarm yeniden onaylanamaz.");
                }

                alarm.Status = "Onaylandı";
                alarm.AcknowledgedAt = DateTimeOffset.UtcNow;
                alarm.AcknowledgedBy = ResolveActor();
                await _context.SaveChangesAsync(cancellationToken);
                var dto = ToDto(alarm);
                await _realtime.AlarmUpdatedAsync(dto, cancellationToken);
                return Ok(dto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "{AlarmId} numaralı alarm onaylanırken beklenmeyen hata oluştu.", id);
                return Problem(statusCode: StatusCodes.Status500InternalServerError, title: "Alarm onaylanamadı.");
            }
        }

        [HttpPut("resolve/{id}")]
        [Authorize(Policy = PolicyNames.AlarmManage)]
        public async Task<ActionResult<AlarmDto>> ResolveAlarm(int id, CancellationToken cancellationToken)
        {
            try
            {
                var alarm = await _context.Alarms.FindAsync([id], cancellationToken);
                if (alarm == null)
                {
                    return Problem(statusCode: StatusCodes.Status404NotFound, title: "Alarm bulunamadı.");
                }

                if (alarm.Status == "Çözüldü")
                {
                    return Ok(ToDto(alarm));
                }

                // Soft-close for audit: never hard-delete downtime records.
                if (alarm.AcknowledgedAt is null)
                {
                    alarm.AcknowledgedAt = DateTimeOffset.UtcNow;
                    alarm.AcknowledgedBy = ResolveActor();
                }

                alarm.Status = "Çözüldü";
                alarm.ResolvedAt = DateTimeOffset.UtcNow;
                alarm.ResolvedBy = ResolveActor();
                await _context.SaveChangesAsync(cancellationToken);
                await _downtimeEvents.CloseOpenForAlarmAsync(alarm.Id, alarm.ResolvedAt.Value, cancellationToken);
                await _runtime.RefreshAfterAlarmResolvedAsync(alarm.Station, cancellationToken);

                await _auditLog.WriteAsync(
                    AuditEntityTypes.Alarm,
                    alarm.Id.ToString(),
                    AuditActions.Resolve,
                    User,
                    details: $"Station={alarm.Station};Title={alarm.Title}",
                    cancellationToken: cancellationToken);

                _logger.LogInformation(
                    "Alarm resolved. AlarmId={AlarmId} Station={Station} Title={Title} ResolvedBy={ResolvedBy}",
                    alarm.Id, alarm.Station, alarm.Title, alarm.ResolvedBy);

                var dto = ToDto(alarm);
                await _realtime.AlarmUpdatedAsync(dto, cancellationToken);
                return Ok(dto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "{AlarmId} numaralı alarm çözülürken beklenmeyen hata oluştu.", id);
                return Problem(statusCode: StatusCodes.Status500InternalServerError, title: "Alarm çözülemedi.");
            }
        }

        private string ResolveActor()
        {
            return User.FindFirstValue("display_name")
                ?? User.Identity?.Name
                ?? User.FindFirstValue(ClaimTypes.Name)
                ?? User.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? "sistem";
        }

        private static AlarmDto ToDto(Alarm alarm)
        {
            return new AlarmDto
            {
                Id = alarm.Id,
                Title = alarm.Title,
                Station = alarm.Station,
                Severity = alarm.Severity,
                Time = alarm.Time,
                Status = alarm.Status,
                Description = alarm.Description,
                AcknowledgedAt = alarm.AcknowledgedAt,
                AcknowledgedBy = alarm.AcknowledgedBy,
                ResolvedAt = alarm.ResolvedAt,
                ResolvedBy = alarm.ResolvedBy,
                ShiftSessionId = alarm.ShiftSessionId
            };
        }
    }
}
