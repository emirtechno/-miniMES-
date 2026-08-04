using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MiniMesApi.DTOs;
using MiniMesApi.Security;
using MiniMesApi.Services;

namespace MiniMesApi.Controllers;

/// <summary>
/// Factory-wide shop-floor simulation: seeds open work orders + lots, then the client
/// starts multi-line shifts / Live Stream toward those targets.
/// </summary>
[Route("api/[controller]")]
[ApiController]
[Authorize]
public sealed class SimulationController(IFactorySimulationService simulation) : ControllerBase
{
    [HttpPost("factory/start")]
    [Authorize(Policy = PolicyNames.ProductionWrite)]
    public async Task<ActionResult<FactorySimulationStartResultDto>> StartFactory(
        [FromBody] StartFactorySimulationRequest? request,
        CancellationToken cancellationToken)
    {
        var result = await simulation.StartAsync(
            request ?? new StartFactorySimulationRequest(),
            cancellationToken);
        return Ok(result);
    }

    [HttpGet("factory/status")]
    [Authorize(Policy = PolicyNames.MetricsRead)]
    public async Task<ActionResult<FactorySimulationStatusDto>> GetFactoryStatus(
        CancellationToken cancellationToken)
    {
        var status = await simulation.GetStatusAsync(cancellationToken);
        return Ok(status);
    }
}
