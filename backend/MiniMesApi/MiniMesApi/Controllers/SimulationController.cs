using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MiniMesApi.DTOs;
using MiniMesApi.Security;
using MiniMesApi.Services;

namespace MiniMesApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public sealed class SimulationController(
    IFactorySimulationControl simulationControl,
    IShopFloorResetService shopFloorReset) : ControllerBase
{
    /// <summary>Çalışma zamanı fabrika-simülasyon kapısı (operatör vardiyasından bağımsız).</summary>
    [HttpGet("status")]
    [Authorize(Policy = PolicyNames.MetricsRead)]
    public async Task<ActionResult<SimulationStatusDto>> GetStatus(CancellationToken cancellationToken)
    {
        return Ok(await simulationControl.GetStatusAsync(cancellationToken));
    }

    [HttpPut("enabled")]
    [Authorize(Policy = PolicyNames.SimulationControl)]
    public async Task<ActionResult<SimulationStatusDto>> SetEnabled(
        [FromBody] SetSimulationEnabledDto request,
        CancellationToken cancellationToken)
    {
        var updated = await simulationControl.SetEnabledAsync(
            request.Enabled,
            ResolveDisplayName(),
            cancellationToken);
        return Ok(updated);
    }

    /// <summary>
    /// Shop-floor telemetri, oturum, alarm ve WO ilerleme sayaçlarını temizler.
    /// Identity kullanıcıları ile ürün/istasyon kataloğunu silmez. Onay: "SIFIRLA".
    /// </summary>
    [HttpPost("reset-shop-floor")]
    [Authorize(Policy = PolicyNames.SimulationControl)]
    public async Task<ActionResult<ShopFloorResetResultDto>> ResetShopFloor(
        [FromBody] ResetShopFloorDto request,
        CancellationToken cancellationToken)
    {
        if (!string.Equals(
                request.Confirmation?.Trim(),
                ShopFloorResetService.ConfirmationPhrase,
                StringComparison.Ordinal))
        {
            return Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: $"Onay metni hatalı. Devam etmek için \"{ShopFloorResetService.ConfirmationPhrase}\" yazın.");
        }

        var result = await shopFloorReset.ResetAsync(ResolveDisplayName(), cancellationToken);
        return Ok(result);
    }

    private string ResolveDisplayName() =>
        User.FindFirstValue("display_name")
        ?? User.Identity?.Name
        ?? User.FindFirstValue(ClaimTypes.Name)
        ?? User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? "unknown";
}
