namespace MiniMesApi.DTOs;

public sealed class SimulationStatusDto
{
    public bool Enabled { get; init; }

    /// <summary>Always "backend" — distinguishes from any future client-side mock.</summary>
    public string Source { get; init; } = "backend";

    public DateTimeOffset? UpdatedAt { get; init; }

    public string? UpdatedBy { get; init; }
}

public sealed class SetSimulationEnabledDto
{
    public bool Enabled { get; init; }
}
