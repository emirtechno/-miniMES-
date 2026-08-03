namespace MiniMesApi.Models;

public static class ShiftCatalog
{
    public const string ShiftA = "SHIFT_A";
    public const string ShiftB = "SHIFT_B";
    public const string ShiftC = "SHIFT_C";

    public static readonly IReadOnlyList<string> All =
    [
        ShiftA,
        ShiftB,
        ShiftC
    ];

    public static bool Contains(string? shiftCode) =>
        !string.IsNullOrWhiteSpace(shiftCode) &&
        All.Contains(shiftCode, StringComparer.Ordinal);

    public static string ResolveForUtc(DateTimeOffset timestampUtc)
    {
        var hour = timestampUtc.UtcDateTime.Hour;
        return hour switch
        {
            >= 6 and < 14 => ShiftA,
            >= 14 and < 22 => ShiftB,
            _ => ShiftC
        };
    }

    public static string DisplayName(string shiftCode) => shiftCode switch
    {
        ShiftA => "Vardiya A (06–14)",
        ShiftB => "Vardiya B (14–22)",
        ShiftC => "Vardiya C (22–06)",
        _ => shiftCode
    };
}
