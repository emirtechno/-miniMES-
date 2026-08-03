using System.ComponentModel.DataAnnotations;

namespace MiniMesApi.Options;

public sealed class MachineMetricRetentionOptions
{
    public const string SectionName = "MachineMetricRetention";

    public bool Enabled { get; init; }

    [Range(1, 3650)]
    public int RetentionDays { get; init; } = 30;

    [Range(1, 168)]
    public int CleanupIntervalHours { get; init; } = 24;

    [Range(100, 10000)]
    public int BatchSize { get; init; } = 5000;
}
