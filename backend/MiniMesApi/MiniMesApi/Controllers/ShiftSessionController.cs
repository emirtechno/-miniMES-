using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MiniMesApi.DTOs;
using MiniMesApi.Models;
using MiniMesApi.Security;
using MiniMesApi.Services;

namespace MiniMesApi.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize(Policy = PolicyNames.ProductionWrite)]
public class ShiftSessionController(
    MesDbContext context,
    IStationRuntimeService runtimeService,
    IDowntimeEventService downtimeEvents,
    IAuditLogService auditLog,
    IMesRealtimePublisher realtime,
    ILogger<ShiftSessionController> logger) : ControllerBase
{
    [HttpGet("active")]
    public async Task<ActionResult<ShiftSessionDto?>> GetActive(
        [FromQuery] string? stationId = null,
        CancellationToken cancellationToken = default)
    {
        var userId = ResolveUserId();
        var query = context.ShiftSessions.AsNoTracking()
            .Where(session => session.UserId == userId
                && session.Status != ShiftSessionStatuses.Ended);
        if (!string.IsNullOrWhiteSpace(stationId))
        {
            query = query.Where(session => session.StationId == stationId);
        }

        var session = await query
            .OrderByDescending(item => item.StartedAt)
            .FirstOrDefaultAsync(cancellationToken);

        if (session is null) return Ok(null);

        var summary = await ShiftSessionAggregator.BuildAsync(context, session, cancellationToken);
        return Ok(await ToDtoAsync(session, cancellationToken, summary));
    }

    [HttpGet("history")]
    public async Task<ActionResult<IReadOnlyList<ShiftSessionDto>>> GetHistory(
        [FromQuery] int limit = 20,
        [FromQuery] string? stationId = null,
        CancellationToken cancellationToken = default)
    {
        var userId = ResolveUserId();
        var take = Math.Clamp(limit, 1, 100);
        var query = context.ShiftSessions.AsNoTracking()
            .Where(session => session.UserId == userId);

        if (!string.IsNullOrWhiteSpace(stationId))
        {
            query = query.Where(session => session.StationId == stationId);
        }

        var sessions = await query
            .OrderByDescending(session => session.StartedAt)
            .Take(take)
            .ToListAsync(cancellationToken);

        var result = new List<ShiftSessionDto>(sessions.Count);
        foreach (var session in sessions)
        {
            ShiftSessionSummaryDto? summary = null;
            if (session.Status == ShiftSessionStatuses.Ended)
            {
                summary = ShiftSessionAggregator.FromPersisted(session)
                    ?? await ShiftSessionAggregator.BuildAsync(context, session, cancellationToken);
            }
            else
            {
                summary = await ShiftSessionAggregator.BuildAsync(context, session, cancellationToken);
            }

            result.Add(await ToDtoAsync(session, cancellationToken, summary));
        }

        return Ok(result);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<ShiftSessionDetailDto>> GetById(
        int id,
        [FromQuery] int tickLimit = 12,
        CancellationToken cancellationToken = default)
    {
        var userId = ResolveUserId();
        var session = await context.ShiftSessions.AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == id && item.UserId == userId, cancellationToken);
        if (session is null) return NotFound();

        ShiftSessionSummaryDto? summary;
        if (session.Status == ShiftSessionStatuses.Ended)
        {
            summary = ShiftSessionAggregator.FromPersisted(session)
                ?? await ShiftSessionAggregator.BuildAsync(context, session, cancellationToken);
        }
        else
        {
            summary = await ShiftSessionAggregator.BuildAsync(context, session, cancellationToken);
        }

        var take = Math.Clamp(tickLimit, 0, 50);
        var ticks = take == 0
            ? []
            : await context.MachineMetrics.AsNoTracking()
                .Where(metric => metric.ShiftSessionId == session.Id
                    || (metric.ShiftSessionId == null
                        && metric.StationId == session.StationId
                        && metric.RecordedAt >= session.StartedAt
                        && metric.RecordedAt <= (session.EndedAt ?? DateTimeOffset.UtcNow)))
                .OrderByDescending(metric => metric.RecordedAt)
                .ThenByDescending(metric => metric.Id)
                .Take(take)
                .ToListAsync(cancellationToken);

        // Oturum etiketli tick varsa onları tercih et (legacy zaman aralığına düşmeden).
        if (ticks.Any(metric => metric.ShiftSessionId == session.Id))
        {
            ticks = ticks.Where(metric => metric.ShiftSessionId == session.Id).ToList();
        }

        var events = await context.ShiftSessionEvents.AsNoTracking()
            .Where(item => item.ShiftSessionId == session.Id)
            .OrderByDescending(item => item.OccurredAt)
            .ThenByDescending(item => item.Id)
            .Take(100)
            .Select(item => new ShiftSessionEventDto
            {
                Id = item.Id,
                FromStatus = item.FromStatus,
                ToStatus = item.ToStatus,
                ReasonCode = item.ReasonCode,
                OccurredAt = item.OccurredAt,
                ActorUserId = item.ActorUserId,
                Notes = item.Notes
            })
            .ToListAsync(cancellationToken);

        return Ok(new ShiftSessionDetailDto
        {
            Session = await ToDtoAsync(session, cancellationToken, summary),
            RecentTicks = ticks.Select(MetricIngestService.ToDto).ToList(),
            Events = events
        });
    }

    [HttpPost("start")]
    public async Task<ActionResult<ShiftSessionDto>> Start(
        [FromBody] StartShiftSessionDto request,
        CancellationToken cancellationToken)
    {
        if (!StationCatalog.Contains(request.StationId))
        {
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Geçersiz istasyon kimliği.");
        }

        if (!ShiftCatalog.Contains(request.ShiftCode))
        {
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Geçersiz vardiya kodu.");
        }

        if (request.ActiveWorkOrderId is int woId)
        {
            var woExists = await context.WorkOrders.AsNoTracking()
                .AnyAsync(order => order.Id == woId && order.DeletedAt == null, cancellationToken);
            if (!woExists)
            {
                return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Geçersiz iş emri.");
            }
        }

        var userId = ResolveUserId();
        var open = await context.ShiftSessions
            .AnyAsync(session => session.UserId == userId && session.Status != ShiftSessionStatuses.Ended, cancellationToken);
        if (open)
        {
            return Problem(statusCode: StatusCodes.Status409Conflict, title: "Zaten aktif bir vardiya oturumu var.");
        }

        var now = DateTimeOffset.UtcNow;
        var session = new ShiftSession
        {
            UserId = userId,
            StationId = request.StationId,
            ShiftCode = request.ShiftCode,
            OperatorName = string.IsNullOrWhiteSpace(request.OperatorName)
                ? ResolveDisplayName()
                : request.OperatorName.Trim(),
            SecondaryOperatorName = string.IsNullOrWhiteSpace(request.SecondaryOperatorName)
                ? null
                : request.SecondaryOperatorName.Trim(),
            SecondaryOperatorUserId = string.IsNullOrWhiteSpace(request.SecondaryOperatorUserId)
                ? null
                : request.SecondaryOperatorUserId.Trim(),
            ActiveWorkOrderId = request.ActiveWorkOrderId,
            StartedAt = now,
            Status = ShiftSessionStatuses.Active,
            CreatedBy = ResolveDisplayName(),
            UpdatedBy = ResolveDisplayName(),
            UpdatedAt = now
        };
        context.ShiftSessions.Add(session);
        await context.SaveChangesAsync(cancellationToken);

        await AddTransitionAsync(
            session.Id,
            fromStatus: string.Empty,
            toStatus: ShiftSessionStatuses.Active,
            reasonCode: null,
            notes: "Shift started",
            cancellationToken);

        await auditLog.WriteAsync(
            AuditEntityTypes.ShiftSession,
            session.Id.ToString(),
            AuditActions.Start,
            User,
            details: $"Station={session.StationId};Shift={session.ShiftCode};WO={session.ActiveWorkOrderId}",
            cancellationToken: cancellationToken);

        // Aktif vardiya, üretimi engelleyen bir şey yoksa StationRuntime → Running yapmalı.
        await runtimeService.HealRuntimeForStationAsync(session.StationId, cancellationToken);

        logger.LogInformation(
            "ShiftSession started. SessionId={SessionId} StationId={StationId} ShiftCode={ShiftCode} UserId={UserId}",
            session.Id, session.StationId, session.ShiftCode, session.UserId);

        var emptySummary = new ShiftSessionSummaryDto
        {
            DurationMinutes = 0,
            GoodCount = 0,
            ActualCount = 0,
            NokCount = 0,
            ScrapLogQuantity = 0,
            DowntimeSeconds = 0,
            OeePercent = null
        };
        var dto = await ToDtoAsync(session, cancellationToken, emptySummary);
        await realtime.ShiftUpdatedAsync(dto, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = session.Id }, dto);
    }

    [HttpPost("{id:int}/downtime")]
    public async Task<ActionResult<ShiftSessionDto>> Downtime(
        int id,
        [FromBody] ShiftDowntimeDto request,
        CancellationToken cancellationToken)
    {
        // Ön kontrol — asıl yazma CreateExecutionStrategy içinde (retry + transaction uyumu).
        if (await FindOwnedActiveAsync(id, cancellationToken) is null) return NotFound();

        Alarm? alarm = null;
        ShiftSession? session = null;

        // NEDEN: EnableRetryOnFailure varken BeginTransaction yalnızca execution strategy içinde güvenli.
        var strategy = context.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            session = await FindOwnedActiveAsync(id, cancellationToken)
                ?? throw new InvalidOperationException("Aktif vardiya oturumu bulunamadı.");

            await using var transaction = context.Database.IsRelational()
                ? await context.Database.BeginTransactionAsync(cancellationToken)
                : null;

            var fromStatus = session.Status;
            var now = DateTimeOffset.UtcNow;
            session.Status = ShiftSessionStatuses.OnBreak;
            session.BreakReason = request.ReasonCode;
            session.BreakStartedAt = now;
            session.SetupStartedAt = null;
            session.UpdatedAt = now;
            session.UpdatedBy = ResolveDisplayName();

            var mode = request.Emergency ? StationRuntimeModes.Down : StationRuntimeModes.Paused;
            await runtimeService.PauseAsync(
                session.StationId,
                $"Duruş: {request.ReasonName ?? request.ReasonCode}",
                mode,
                cancellationToken);

            alarm = new Alarm
            {
                Title = request.Emergency
                    ? $"ARIZA / ACİL — {request.ReasonName ?? request.ReasonCode}"
                    : $"Duruş Bildirimi — {request.ReasonName ?? request.ReasonCode}",
                Station = session.StationId,
                Severity = request.Emergency ? "Kritik" : (request.IsPlanned ? "Uyarı" : "Yüksek"),
                Description = $"Operatör {session.OperatorName} duruş kaydı oluşturdu.",
                Time = now,
                Status = "Açık",
                ShiftSessionId = session.Id
            };
            context.Alarms.Add(alarm);
            await context.SaveChangesAsync(cancellationToken);

            await downtimeEvents.CloseOpenForSessionAsync(session.Id, now, cancellationToken);
            await downtimeEvents.OpenAsync(
                session.StationId,
                request.ReasonCode,
                request.ReasonName,
                request.IsPlanned,
                request.Emergency,
                DowntimeEventSources.Operator,
                session.Id,
                alarm.Id,
                cancellationToken);

            await AddTransitionAsync(
                session.Id,
                fromStatus,
                ShiftSessionStatuses.OnBreak,
                request.ReasonCode,
                request.Emergency ? "Emergency downtime" : "Operator downtime",
                cancellationToken);

            if (transaction is not null)
                await transaction.CommitAsync(cancellationToken);
        });

        await realtime.AlarmCreatedAsync(AlarmToDto(alarm!), cancellationToken);

        var summary = await ShiftSessionAggregator.BuildAsync(context, session!, cancellationToken);
        var dto = await ToDtoAsync(session!, cancellationToken, summary);
        await realtime.ShiftUpdatedAsync(dto, cancellationToken);
        return Ok(dto);
    }

    [HttpPost("{id:int}/setup")]
    public async Task<ActionResult<ShiftSessionDto>> Setup(int id, CancellationToken cancellationToken)
    {
        if (await FindOwnedActiveAsync(id, cancellationToken) is null) return NotFound();

        Alarm? alarm = null;
        ShiftSession? session = null;

        // NEDEN: EnableRetryOnFailure varken BeginTransaction yalnızca execution strategy içinde güvenli.
        var strategy = context.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            session = await FindOwnedActiveAsync(id, cancellationToken)
                ?? throw new InvalidOperationException("Aktif vardiya oturumu bulunamadı.");

            await using var transaction = context.Database.IsRelational()
                ? await context.Database.BeginTransactionAsync(cancellationToken)
                : null;

            var fromStatus = session.Status;
            var now = DateTimeOffset.UtcNow;
            session.Status = ShiftSessionStatuses.InSetup;
            session.BreakReason = DowntimeReasonCatalog.Changeover;
            session.SetupStartedAt = now;
            session.BreakStartedAt = null;
            session.UpdatedAt = now;
            session.UpdatedBy = ResolveDisplayName();

            await runtimeService.PauseAsync(session.StationId, "Setup / model değişimi", StationRuntimeModes.Paused, cancellationToken);

            alarm = new Alarm
            {
                Title = "Model Değişimi / Setup",
                Station = session.StationId,
                Severity = "Uyarı",
                Description = $"Setup timer başlatıldı — {session.OperatorName}",
                Time = now,
                Status = "Açık",
                ShiftSessionId = session.Id
            };
            context.Alarms.Add(alarm);
            await context.SaveChangesAsync(cancellationToken);

            await downtimeEvents.CloseOpenForSessionAsync(session.Id, now, cancellationToken);
            await downtimeEvents.OpenAsync(
                session.StationId,
                DowntimeReasonCatalog.Changeover,
                DowntimeReasonCatalog.DisplayName(DowntimeReasonCatalog.Changeover),
                isPlanned: true,
                isEmergency: false,
                DowntimeEventSources.Operator,
                session.Id,
                alarm.Id,
                cancellationToken);

            await AddTransitionAsync(
                session.Id,
                fromStatus,
                ShiftSessionStatuses.InSetup,
                DowntimeReasonCatalog.Changeover,
                "Setup / changeover",
                cancellationToken);

            if (transaction is not null)
                await transaction.CommitAsync(cancellationToken);
        });

        await realtime.AlarmCreatedAsync(AlarmToDto(alarm!), cancellationToken);

        var summary = await ShiftSessionAggregator.BuildAsync(context, session!, cancellationToken);
        var dto = await ToDtoAsync(session!, cancellationToken, summary);
        await realtime.ShiftUpdatedAsync(dto, cancellationToken);
        return Ok(dto);
    }

    [HttpPost("{id:int}/resume")]
    public async Task<ActionResult<ShiftSessionDto>> Resume(int id, CancellationToken cancellationToken)
    {
        var session = await FindOwnedActiveAsync(id, cancellationToken);
        if (session is null) return NotFound();

        var actor = ResolveDisplayName();
        var fromStatus = session.Status;
        // Bu akışın açtığı operatör hold alarmlarını (duruş/setup) temizle ki resume başarılı olsun.
        await runtimeService.ClearOperatorHoldAlarmsAsync(session.StationId, actor, cancellationToken);

        if (await runtimeService.HasOpenBlockingAlarmAsync(session.StationId, cancellationToken))
        {
            return Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "Engelleyici alarmlar çözülmeden üretime dönülemez. Andon/Kalite’den alarmı Çözüldü yapın.");
        }

        var now = DateTimeOffset.UtcNow;
        await downtimeEvents.CloseOpenForSessionAsync(session.Id, now, cancellationToken);

        session.Status = ShiftSessionStatuses.Active;
        session.BreakReason = null;
        session.BreakStartedAt = null;
        session.SetupStartedAt = null;
        session.UpdatedAt = now;
        session.UpdatedBy = actor;
        await context.SaveChangesAsync(cancellationToken);

        await AddTransitionAsync(
            session.Id,
            fromStatus,
            ShiftSessionStatuses.Active,
            reasonCode: null,
            notes: "Resume production",
            cancellationToken);

        // Engelleyici alarm yokken Active vardiyayı Running'e zorla (Active+Paused uyumsuzluğunu da düzeltir).
        var mode = await runtimeService.HealRuntimeForStationAsync(session.StationId, cancellationToken);
        if (mode != StationRuntimeModes.Running)
        {
            return Problem(statusCode: StatusCodes.Status409Conflict, title: "İstasyon Running durumuna alınamadı.");
        }

        var summary = await ShiftSessionAggregator.BuildAsync(context, session, cancellationToken);
        var dto = await ToDtoAsync(session, cancellationToken, summary);
        await realtime.ShiftUpdatedAsync(dto, cancellationToken);
        return Ok(dto);
    }

    [HttpPost("{id:int}/end")]
    public async Task<ActionResult<ShiftSessionDto>> End(int id, CancellationToken cancellationToken)
    {
        var session = await FindOwnedActiveAsync(id, cancellationToken);
        if (session is null) return NotFound();

        var fromStatus = session.Status;
        var now = DateTimeOffset.UtcNow;
        await downtimeEvents.CloseOpenForSessionAsync(session.Id, now, cancellationToken);

        session.Status = ShiftSessionStatuses.Ended;
        session.EndedAt = now;
        session.BreakStartedAt = null;
        session.SetupStartedAt = null;
        session.UpdatedAt = now;
        session.UpdatedBy = ResolveDisplayName();

        var summary = await ShiftSessionAggregator.BuildAsync(context, session, cancellationToken);
        ShiftSessionAggregator.ApplyPersistedSummary(session, summary);
        await context.SaveChangesAsync(cancellationToken);

        await AddTransitionAsync(
            session.Id,
            fromStatus,
            ShiftSessionStatuses.Ended,
            reasonCode: null,
            notes: "Shift ended",
            cancellationToken);

        await auditLog.WriteAsync(
            AuditEntityTypes.ShiftSession,
            session.Id.ToString(),
            AuditActions.End,
            User,
            details: $"Station={session.StationId};Good={summary.GoodCount};Nok={summary.NokCount};Scrap={summary.ScrapLogQuantity}",
            cancellationToken: cancellationToken);

        await runtimeService.PauseAsync(
            session.StationId,
            "Vardiya bitti",
            StationRuntimeModes.Paused,
            cancellationToken);

        logger.LogInformation(
            "ShiftSession ended. SessionId={SessionId} StationId={StationId} UserId={UserId} DurationMinutes={DurationMinutes} Good={Good} Nok={Nok}",
            session.Id,
            session.StationId,
            session.UserId,
            summary.DurationMinutes,
            summary.GoodCount,
            summary.NokCount);

        var dto = await ToDtoAsync(session, cancellationToken, summary);
        await realtime.ShiftUpdatedAsync(dto, cancellationToken);
        return Ok(dto);
    }

    private async Task AddTransitionAsync(
        int sessionId,
        string fromStatus,
        string toStatus,
        string? reasonCode,
        string? notes,
        CancellationToken cancellationToken)
    {
        context.ShiftSessionEvents.Add(new ShiftSessionEvent
        {
            ShiftSessionId = sessionId,
            FromStatus = fromStatus,
            ToStatus = toStatus,
            ReasonCode = reasonCode,
            OccurredAt = DateTimeOffset.UtcNow,
            ActorUserId = ResolveUserId(),
            Notes = notes
        });
        await context.SaveChangesAsync(cancellationToken);
    }

    private async Task<ShiftSession?> FindOwnedActiveAsync(int id, CancellationToken cancellationToken)
    {
        var userId = ResolveUserId();
        return await context.ShiftSessions
            .FirstOrDefaultAsync(
                session => session.Id == id
                    && session.UserId == userId
                    && session.Status != ShiftSessionStatuses.Ended,
                cancellationToken);
    }

    private string ResolveUserId() =>
        User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? User.Identity?.Name
        ?? "unknown";

    private string ResolveDisplayName() =>
        User.FindFirstValue("display_name")
        ?? User.Identity?.Name
        ?? User.FindFirstValue(ClaimTypes.Name)
        ?? ResolveUserId();

    private async Task<ShiftSessionDto> ToDtoAsync(
        ShiftSession session,
        CancellationToken cancellationToken,
        ShiftSessionSummaryDto? summary = null)
    {
        var runtime = await runtimeService.GetOrCreateAsync(session.StationId, cancellationToken);
        var blocked = await runtimeService.HasOpenBlockingAlarmAsync(session.StationId, cancellationToken);
        return new ShiftSessionDto
        {
            Id = session.Id,
            UserId = session.UserId,
            StationId = session.StationId,
            ShiftCode = session.ShiftCode,
            ShiftName = ShiftCatalog.DisplayName(session.ShiftCode),
            OperatorName = session.OperatorName,
            SecondaryOperatorName = session.SecondaryOperatorName,
            SecondaryOperatorUserId = session.SecondaryOperatorUserId,
            ActiveWorkOrderId = session.ActiveWorkOrderId,
            StartedAt = session.StartedAt,
            EndedAt = session.EndedAt,
            BreakStartedAt = session.BreakStartedAt,
            SetupStartedAt = session.SetupStartedAt,
            Status = session.Status,
            BreakReason = session.BreakReason,
            RuntimeMode = runtime.Mode,
            PauseReason = runtime.PauseReason,
            HasBlockingAlarms = blocked,
            Summary = summary
        };
    }

    private static AlarmDto AlarmToDto(Alarm alarm) => new()
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

/// <summary>
/// Andon board okumaları (yalnız MetricsRead — <see cref="ShiftSessionController"/> üzerindeki ProductionWrite ile AND edilmez).
/// </summary>
[Route("api/ShiftSession")]
[ApiController]
[Authorize(Policy = PolicyNames.MetricsRead)]
public class ShiftSessionBoardController(MesDbContext context) : ControllerBase
{
    [HttpGet("board")]
    public async Task<ActionResult<IReadOnlyList<ShiftSessionBoardItemDto>>> GetBoard(
        CancellationToken cancellationToken = default)
    {
        var board = await ShiftSessionAggregator.BuildBoardAsync(context, cancellationToken);
        return Ok(board);
    }
}
