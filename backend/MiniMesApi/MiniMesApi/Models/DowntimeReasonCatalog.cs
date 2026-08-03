namespace MiniMesApi.Models;

public static class DowntimeReasonCatalog
{
    public const string None = "NONE";
    public const string PlannedMaintenance = "PLANNED_MAINTENANCE";
    public const string Breakdown = "BREAKDOWN";
    public const string MaterialShortage = "MATERIAL_SHORTAGE";
    public const string Changeover = "CHANGEOVER";
    public const string NoOperator = "NO_OPERATOR";
    public const string QualityHold = "QUALITY_HOLD";
    public const string Other = "OTHER";

    public static readonly IReadOnlyList<string> All =
    [
        None,
        PlannedMaintenance,
        Breakdown,
        MaterialShortage,
        Changeover,
        NoOperator,
        QualityHold,
        Other
    ];

    public static readonly IReadOnlyList<string> Unplanned =
    [
        Breakdown,
        MaterialShortage,
        NoOperator,
        QualityHold,
        Other
    ];

    public static readonly IReadOnlyList<string> Planned =
    [
        PlannedMaintenance,
        Changeover
    ];

    public static bool Contains(string? reasonCode) =>
        !string.IsNullOrWhiteSpace(reasonCode) &&
        All.Contains(reasonCode, StringComparer.Ordinal);

    public static bool IsPlanned(string? reasonCode) =>
        !string.IsNullOrWhiteSpace(reasonCode) &&
        Planned.Contains(reasonCode, StringComparer.Ordinal);

    public static string DisplayName(string reasonCode) => reasonCode switch
    {
        None => "Duruş yok",
        PlannedMaintenance => "Planlı bakım",
        Breakdown => "Arıza",
        MaterialShortage => "Malzeme eksikliği",
        Changeover => "Model/hat değişimi",
        NoOperator => "Operatör yok",
        QualityHold => "Kalite bekletme",
        Other => "Diğer",
        _ => reasonCode
    };
}
