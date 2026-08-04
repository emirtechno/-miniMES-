namespace MiniMesApi.Models;

public static class StationCatalog
{
    public const string AssemblyLine1 = "Montaj_Hatti_01";
    public const string AssemblyLine2 = "Montaj_Hatti_02";
    public const string AssemblyLine3 = "Montaj_Hatti_03";
    public const string ElectronicsBoardAssembly = "Elektronik_Kart_Montaj";
    public const string TestAndQuality = "Test_Ve_Kalite_Istasyonu";
    public const string PackagingLine1 = "Paketleme_Hatti_01";
    public const string PackagingLine2 = "Paketleme_Hatti_02";
    public const string FinalInspection = "Final_Kontrol";
    /// <summary>Legacy combined station kept for backward-compatible records and seeds.</summary>
    public const string TestAndPackaging = "Test_Ve_Paketleme_Istasyonu";

    public static readonly IReadOnlyCollection<string> All =
    [
        AssemblyLine1,
        AssemblyLine2,
        AssemblyLine3,
        ElectronicsBoardAssembly,
        TestAndQuality,
        PackagingLine1,
        PackagingLine2,
        FinalInspection,
        TestAndPackaging
    ];

    /// <summary>
    /// Production lines used by factory-wide simulation (excludes pure QC / shipping / legacy).
    /// </summary>
    public static readonly string[] ProductionLines =
    [
        AssemblyLine1,
        AssemblyLine2,
        AssemblyLine3,
        ElectronicsBoardAssembly,
        PackagingLine1,
        PackagingLine2
    ];

    public static bool Contains(string stationId) =>
        All.Contains(stationId, StringComparer.Ordinal);

    public static bool IsProductionLine(string stationId) =>
        ProductionLines.Contains(stationId, StringComparer.Ordinal);
}
