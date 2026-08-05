namespace MiniMesApi.Models;

public readonly record struct ShiftWindow(string Code, DateTimeOffset Start, DateTimeOffset End);

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

    /// <summary>
    /// Current shift occurrence window in UTC (A 06–14, B 14–22, C 22–06 overnight).
    /// </summary>
    public static ShiftWindow ResolveWindowForUtc(DateTimeOffset timestampUtc)
    {
        var utc = timestampUtc.ToUniversalTime();
        var date = utc.UtcDateTime.Date;
        var hour = utc.UtcDateTime.Hour;

        if (hour is >= 6 and < 14)
        {
            return new ShiftWindow(
                ShiftA,
                new DateTimeOffset(date.AddHours(6), TimeSpan.Zero),
                new DateTimeOffset(date.AddHours(14), TimeSpan.Zero));
        }

        if (hour is >= 14 and < 22)
        {
            return new ShiftWindow(
                ShiftB,
                new DateTimeOffset(date.AddHours(14), TimeSpan.Zero),
                new DateTimeOffset(date.AddHours(22), TimeSpan.Zero));
        }

        if (hour >= 22)
        {
            return new ShiftWindow(
                ShiftC,
                new DateTimeOffset(date.AddHours(22), TimeSpan.Zero),
                new DateTimeOffset(date.AddDays(1).AddHours(6), TimeSpan.Zero));
        }

        // 00:00–05:59 → overnight Shift C that started previous calendar day 22:00
        return new ShiftWindow(
            ShiftC,
            new DateTimeOffset(date.AddDays(-1).AddHours(22), TimeSpan.Zero),
            new DateTimeOffset(date.AddHours(6), TimeSpan.Zero));
    }

    public static string DisplayName(string shiftCode) => shiftCode switch
    {
        ShiftA => "Vardiya A (06–14)",
        ShiftB => "Vardiya B (14–22)",
        ShiftC => "Vardiya C (22–06)",
        _ => shiftCode
    };
}
