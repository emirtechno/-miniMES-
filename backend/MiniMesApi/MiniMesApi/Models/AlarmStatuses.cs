namespace MiniMesApi.Models;

public static class AlarmStatuses
{
    public const string Open = "Açık";
    public const string Acknowledged = "Onaylandı";
    public const string Resolved = "Çözüldü";
    public const string ClosedLegacy = "Kapalı";

    /// <summary>
    /// Open shop-floor alarms needing resolution. Acknowledged stays open until resolved.
    /// </summary>
    public static bool IsOpen(string? status) =>
        !string.Equals(status, Resolved, StringComparison.Ordinal)
        && !string.Equals(status, ClosedLegacy, StringComparison.Ordinal);
}
