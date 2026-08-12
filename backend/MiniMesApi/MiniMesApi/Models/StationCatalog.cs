namespace MiniMesApi.Models;

public static class StationCatalog
{
    public const string AssemblyLine1 = "Montaj_Hatti_01";
    public const string ElectronicsBoardAssembly = "Elektronik_Kart_Montaj";
    public const string TestAndQuality = "Test_Ve_Kalite_Istasyonu";
    public const string PackagingLine1 = "Paketleme_Hatti_01";
    public const string PackagingLine2 = "Paketleme_Hatti_02";
    public const string FinalInspection = "Final_Kontrol";
    /// <summary>Eski birleşik istasyon — yalnızca geriye uyumlu geçmiş kayıtlar için; shop-floor aktif değil.</summary>
    public const string TestAndPackaging = "Test_Ve_Paketleme_Istasyonu";

    /// <summary>
    /// Canlı shop-floor istasyonları (Andon, OEE sim, yeni alarmlar). Emekli/eski kodlar hariç.
    /// Bu küme dışında tarihsel emekliler: Montaj_Hatti_02 / Montaj_Hatti_03 (katalogdan çıkarıldı)
    /// ve <see cref="TestAndPackaging"/>.
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

    /// <summary>Bilinen katalog kodları — geçmiş/seed uyumu için legacy id'ler dahil.</summary>
    public static readonly IReadOnlyCollection<string> All =
    [
        ..Active,
        TestAndPackaging
    ];

    public static bool Contains(string stationId) =>
        All.Contains(stationId, StringComparer.Ordinal);

    /// <summary>Yalnızca canlı shop-floor istasyonları için true (legacy/emekli değil).</summary>
    public static bool IsActive(string? stationId) =>
        !string.IsNullOrWhiteSpace(stationId)
        && Active.Contains(stationId, StringComparer.Ordinal);
}
