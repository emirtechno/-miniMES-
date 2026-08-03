using System.Globalization;
using System.Text;

namespace MiniMesApi.Infrastructure;

public static class CursorCodec
{
    public static string EncodeString(string value) => Encode(value);

    public static bool TryDecodeString(string? cursor, out string value)
    {
        value = string.Empty;
        return string.IsNullOrWhiteSpace(cursor) || TryDecode(cursor, out value);
    }

    public static string EncodeId(int id) => Encode(id.ToString(CultureInfo.InvariantCulture));

    public static bool TryDecodeId(string? cursor, out int id)
    {
        id = default;
        return string.IsNullOrWhiteSpace(cursor) ||
            (TryDecode(cursor, out var value) &&
             int.TryParse(value, NumberStyles.None, CultureInfo.InvariantCulture, out id));
    }

    public static string EncodeTimestamp(DateTime timestamp, int id) =>
        Encode($"{timestamp.ToUniversalTime().Ticks}:{id}");

    public static bool TryDecodeTimestamp(string? cursor, out DateTime timestamp, out int id)
    {
        timestamp = default;
        id = default;
        if (string.IsNullOrWhiteSpace(cursor))
        {
            return true;
        }

        if (!TryDecode(cursor, out var value))
        {
            return false;
        }

        var parts = value.Split(':', 2);
        return parts.Length == 2 &&
            long.TryParse(parts[0], NumberStyles.None, CultureInfo.InvariantCulture, out var ticks) &&
            ticks >= DateTime.MinValue.Ticks &&
            ticks <= DateTime.MaxValue.Ticks &&
            int.TryParse(parts[1], NumberStyles.None, CultureInfo.InvariantCulture, out id) &&
            SetTimestamp(ticks, out timestamp);
    }

    private static bool SetTimestamp(long ticks, out DateTime timestamp)
    {
        timestamp = new DateTime(ticks, DateTimeKind.Utc);
        return true;
    }

    private static string Encode(string value) =>
        Convert.ToBase64String(Encoding.UTF8.GetBytes(value))
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');

    private static bool TryDecode(string cursor, out string value)
    {
        value = string.Empty;
        try
        {
            var base64 = cursor.Replace('-', '+').Replace('_', '/');
            base64 = base64.PadRight(base64.Length + ((4 - base64.Length % 4) % 4), '=');
            value = Encoding.UTF8.GetString(Convert.FromBase64String(base64));
            return true;
        }
        catch (FormatException)
        {
            return false;
        }
    }
}
