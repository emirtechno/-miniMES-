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
public sealed class SimulationController(IFactorySimulationControl simulationControl) : ControllerBase
{
    /// <summary>Runtime factory-simulation gate (independent of operator shift).</summary>
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

    private string ResolveDisplayName() =>
        User.FindFirstValue("display_name")
        ?? User.Identity?.Name
        ?? User.FindFirstValue(ClaimTypes.Name)
        ?? User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? "unknown";
}
