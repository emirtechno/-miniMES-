namespace MiniMesApi.Models;

public static class StationCatalog
{
    public const string AssemblyLine1 = "Montaj_Hatti_01";
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
        ElectronicsBoardAssembly,
        TestAndQuality,
        PackagingLine1,
        PackagingLine2,
        FinalInspection,
        TestAndPackaging
    ];

    public static bool Contains(string stationId) =>
        All.Contains(stationId, StringComparer.Ordinal);
}
