namespace MiniMesApi.Models;

public static class StationCatalog
{
    public const string AssemblyLine1 = "Montaj_Hatti_01";
    public const string ElectronicsBoardAssembly = "Elektronik_Kart_Montaj";
    public const string TestAndQuality = "Test_Ve_Kalite_Istasyonu";
    public const string PackagingLine1 = "Paketleme_Hatti_01";
    public const string PackagingLine2 = "Paketleme_Hatti_02";
    public const string FinalInspection = "Final_Kontrol";
    /// <summary>Legacy combined station kept for backward-compatible historical records only — not shop-floor active.</summary>
    public const string TestAndPackaging = "Test_Ve_Paketleme_Istasyonu";

    /// <summary>
    /// Live shop-floor stations (Andon, OEE sim, new alarms). Excludes legacy/retired codes.
    /// Retired outside this set historically include Montaj_Hatti_02 / Montaj_Hatti_03 (removed from catalog)
    /// and <see cref="TestAndPackaging"/>.
    /// </summary>
    public static readonly IReadOnlyList<string> Active =
    [
        AssemblyLine1,
        ElectronicsBoardAssembly,
        TestAndQuality,
        PackagingLine1,
        PackagingLine2,
        FinalInspection
    ];

    /// <summary>Known catalog codes including legacy ids kept for historical/seed compatibility.</summary>
    public static readonly IReadOnlyCollection<string> All =
    [
        ..Active,
        TestAndPackaging
    ];

    public static bool Contains(string stationId) =>
        All.Contains(stationId, StringComparer.Ordinal);

    /// <summary>True for live shop-floor stations only (not legacy/retired).</summary>
    public static bool IsActive(string? stationId) =>
        !string.IsNullOrWhiteSpace(stationId)
        && Active.Contains(stationId, StringComparer.Ordinal);
}
