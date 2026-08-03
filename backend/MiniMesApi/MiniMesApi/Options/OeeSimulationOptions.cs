using System.ComponentModel.DataAnnotations;

namespace MiniMesApi.Options;

public sealed class OeeSimulationOptions
{
    public const string SectionName = "OeeSimulation";

    public bool Enabled { get; init; }

    [Range(5, 3600)]
    public int IntervalSeconds { get; init; } = 15;
}
