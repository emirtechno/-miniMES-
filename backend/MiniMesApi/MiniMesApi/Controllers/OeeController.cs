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
}
