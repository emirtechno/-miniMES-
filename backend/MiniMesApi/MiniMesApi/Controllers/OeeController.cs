using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MiniMesApi.DTOs;
using MiniMesApi.Models;
using MiniMesApi.Security;
using MiniMesApi.Services;

namespace MiniMesApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = PolicyNames.MetricsRead)]
public sealed class OeeController(MesDbContext context) : ControllerBase
{
    [HttpGet("stations")]
    public ActionResult<IReadOnlyCollection<string>> GetStations() =>
        Ok(StationCatalog.All);

    [HttpGet("shifts")]
    public ActionResult<IReadOnlyCollection<object>> GetShifts() =>
        Ok(ShiftCatalog.All.Select(code => new
        {
            code,
            name = ShiftCatalog.DisplayName(code)
        }).ToArray());

    [HttpGet("downtime-reasons")]
    public ActionResult<IReadOnlyCollection<object>> GetDowntimeReasons() =>
        Ok(DowntimeReasonCatalog.All.Select(code => new
        {
            code,
            name = DowntimeReasonCatalog.DisplayName(code),
            isPlanned = DowntimeReasonCatalog.IsPlanned(code)
        }).ToArray());

    /// <summary>
    /// İstasyon başına son tek-tick OEE (PLC/sim tick kapsamı). Andon panoları için shift-current tercih edilir.
    /// </summary>
    [HttpGet("latest")]
    public async Task<ActionResult<IReadOnlyList<OeeMetricDto>>> GetLatestForAllStations(
        CancellationToken cancellationToken)
    {
        var latestIds = await context.MachineMetrics
            .AsNoTracking()
            .GroupBy(item => item.StationId)
            .Select(group => group.Max(item => item.Id))
            .ToListAsync(cancellationToken);

        var metrics = await context.MachineMetrics
            .AsNoTracking()
            .Where(item => latestIds.Contains(item.Id))
            .ToListAsync(cancellationToken);

        var byStation = metrics.ToDictionary(item => item.StationId, StringComparer.Ordinal);
        var payload = StationCatalog.All
            .Where(stationId => byStation.ContainsKey(stationId))
            .Select(stationId => OeeCalculator.Calculate(byStation[stationId]))
            .ToArray();

        return Ok(payload);
    }

    [HttpGet("latest/{stationId}")]
    public async Task<ActionResult<OeeMetricDto>> GetLatestMetrics(
        string stationId,
        CancellationToken cancellationToken)
    {
        if (!StationCatalog.Contains(stationId))
        {
            return Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "Geçersiz istasyon kimliği.");
        }

        var metric = await context.MachineMetrics
            .AsNoTracking()
            .Where(item => item.StationId == stationId)
            .OrderByDescending(item => item.RecordedAt)
            .ThenByDescending(item => item.Id)
            .FirstOrDefaultAsync(cancellationToken);

        if (metric is null)
        {
            return Problem(
                statusCode: StatusCodes.Status404NotFound,
                title: "Bu istasyon için metrik bulunamadı.");
        }

        return Ok(OeeCalculator.Calculate(metric));
    }

    /// <summary>
    /// Güncel ShiftCatalog penceresi için vardiya-bugüne OEE toplamları (Σ Actual/Good/NOK + A/P/Q).
    /// Duruş nedeni/durum katmanı istasyon başına mutlak son tick'ten gelir.
    /// </summary>
    [HttpGet("shift-current")]
    public async Task<ActionResult<IReadOnlyList<OeeMetricDto>>> GetCurrentShiftForAllStations(
        CancellationToken cancellationToken)
    {
        var payload = await BuildCurrentShiftMetricsAsync(stationId: null, cancellationToken);
        return Ok(payload);
    }

    [HttpGet("shift-current/{stationId}")]
    public async Task<ActionResult<OeeMetricDto>> GetCurrentShiftForStation(
        string stationId,
        CancellationToken cancellationToken)
    {
        if (!StationCatalog.Contains(stationId))
        {
            return Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "Geçersiz istasyon kimliği.");
        }

        var payload = await BuildCurrentShiftMetricsAsync(stationId, cancellationToken);
        var metric = payload.FirstOrDefault();
        if (metric is null)
        {
            return Problem(
                statusCode: StatusCodes.Status404NotFound,
                title: "Bu istasyon için vardiya metriği bulunamadı.");
        }

        return Ok(metric);
    }

    private async Task<IReadOnlyList<OeeMetricDto>> BuildCurrentShiftMetricsAsync(
        string? stationId,
        CancellationToken cancellationToken)
    {
        var window = ShiftCatalog.ResolveWindowForUtc(DateTimeOffset.UtcNow);

        // NEDEN: Güncel katalog penceresinin zaman aralığı toplamı. Ingest, ShiftCode'u RecordedAt'tan damgalar;
        // ayrıca ShiftCode == window.Code şartı koyma — oturumla override edilmiş eski satırlar
        // pencereden düşene kadar sayılsın.
        var windowQuery = context.MachineMetrics
            .AsNoTracking()
            .Where(item =>
                item.RecordedAt >= window.Start
                && item.RecordedAt < window.End);

        if (!string.IsNullOrWhiteSpace(stationId))
        {
            windowQuery = windowQuery.Where(item => item.StationId == stationId);
        }

        var windowMetrics = await windowQuery.ToListAsync(cancellationToken);

        var latestQuery = context.MachineMetrics.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(stationId))
        {
            latestQuery = latestQuery.Where(item => item.StationId == stationId);
        }

        var latestIds = await latestQuery
            .GroupBy(item => item.StationId)
            .Select(group => group.Max(item => item.Id))
            .ToListAsync(cancellationToken);

        var latestMetrics = latestIds.Count == 0
            ? []
            : await context.MachineMetrics
                .AsNoTracking()
                .Where(item => latestIds.Contains(item.Id))
                .ToListAsync(cancellationToken);

        var latestByStation = latestMetrics.ToDictionary(item => item.StationId, StringComparer.Ordinal);
        var windowByStation = windowMetrics
            .GroupBy(item => item.StationId, StringComparer.Ordinal)
            .ToDictionary(group => group.Key, group => (IReadOnlyList<MachineMetric>)group.ToList(), StringComparer.Ordinal);

        var stationIds = string.IsNullOrWhiteSpace(stationId)
            ? StationCatalog.All
            : [stationId];

        return stationIds
            .Where(id => windowByStation.ContainsKey(id) || latestByStation.ContainsKey(id))
            .Select(id =>
            {
                windowByStation.TryGetValue(id, out var rows);
                latestByStation.TryGetValue(id, out var latest);
                return OeeCalculator.CalculateFromWindow(
                    rows ?? Array.Empty<MachineMetric>(),
                    id,
                    window.Code,
                    latest);
            })
            .ToArray();
    }
}
