namespace MiniMesApi.Models;

public static class StationCatalog
{
    public const string AssemblyLine1 = "Montaj_Hatti_01";
    public const string AssemblyLine2 = "Montaj_Hatti_02";
    public const string TestAndPackaging = "Test_Ve_Paketleme_Istasyonu";

    public static readonly IReadOnlyCollection<string> All =
        [AssemblyLine1, AssemblyLine2, TestAndPackaging];

    public static bool Contains(string stationId) =>
        All.Contains(stationId, StringComparer.Ordinal);
}
