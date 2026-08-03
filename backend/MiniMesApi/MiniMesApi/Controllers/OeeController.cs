using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MiniMesApi.Models;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace MiniMesApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class OeeController : ControllerBase
    {
        private readonly MesDbContext _context;

        public OeeController(MesDbContext context)
        {
            _context = context;
        }

        [HttpGet("latest/{stationId}")]
public async Task<IActionResult> GetLatestMetrics(
    string stationId,
    CancellationToken cancellationToken)
{
    var metric = await _context.MachineMetrics
        .AsNoTracking()
        .Where(m => m.StationId == stationId)
        .OrderByDescending(m => m.RecordedAt)
        .FirstOrDefaultAsync(cancellationToken);

    if (metric == null)
    {
        return NotFound(new { message = "Bu istasyon için metrik bulunamadı." });
    }

    // OEE Hesaplama Mantığı
    double operatingTime = metric.PlannedProductionSeconds - metric.DowntimeSeconds;
    
    // 1. Availability
    double availability = metric.PlannedProductionSeconds > 0 
        ? (operatingTime / metric.PlannedProductionSeconds) * 100 
        : 0;

    // 2. Performance
    double performance = operatingTime > 0 
        ? ((metric.IdealCycleTimeSeconds * metric.ActualProductionCount) / operatingTime) * 100 
        : 0;

    // 3. Quality
    double quality = metric.ActualProductionCount > 0 
        ? ((double)metric.GoodProductionCount / metric.ActualProductionCount) * 100 
        : 0;

    availability = Math.Min(availability, 100.0);
    performance = Math.Min(performance, 100.0);
    quality = Math.Min(quality, 100.0);

    double overallOee = (availability / 100.0) * (performance / 100.0) * (quality / 100.0) * 100.0;

    // Fire (NOK) Sayısı
    int scrapCount = metric.ActualProductionCount - metric.GoodProductionCount;

    return Ok(new
    {
        stationId = metric.StationId,
        availability = Math.Round(availability, 1),
        performance = Math.Round(performance, 1),
        quality = Math.Round(quality, 1),
        oee = Math.Round(overallOee, 1),
        // YENİ EKLENEN CANLI ADET VERİLERİ:
        totalProduction = metric.ActualProductionCount,
        goodProduction = metric.GoodProductionCount,
        scrapProduction = scrapCount,
        lastUpdated = metric.RecordedAt
    });
}
    }
}