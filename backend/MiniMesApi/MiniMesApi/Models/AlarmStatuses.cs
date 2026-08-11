namespace MiniMesApi.Models;

public static class AlarmStatuses
{
    public const string Open = "Açık";
    public const string Acknowledged = "Onaylandı";
    public const string Resolved = "Çözüldü";
    public const string ClosedLegacy = "Kapalı";

    /// <summary>
    /// Çözüm bekleyen açık shop-floor alarmları. Onaylandı, çözülene kadar açık kalır.
    /// </summary>
    public static bool IsOpen(string? status) =>
        !string.Equals(status, Resolved, StringComparison.Ordinal)
        && !string.Equals(status, ClosedLegacy, StringComparison.Ordinal);

    /// <summary>Soft-resolve / eski Kapalı alarmlar — audit geçmişi için saklanır.</summary>
    public static bool IsResolved(string? status) =>
        string.Equals(status, Resolved, StringComparison.Ordinal)
        || string.Equals(status, ClosedLegacy, StringComparison.Ordinal);
}
