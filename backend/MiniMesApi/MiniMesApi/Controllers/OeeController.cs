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
