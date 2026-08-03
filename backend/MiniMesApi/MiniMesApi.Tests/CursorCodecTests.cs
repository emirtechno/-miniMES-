using MiniMesApi.Infrastructure;

namespace MiniMesApi.Tests;

public sealed class CursorCodecTests
{
    [Fact]
    public void Timestamp_cursor_round_trips()
    {
        var timestamp = new DateTimeOffset(2026, 8, 3, 12, 0, 0, TimeSpan.Zero);
        var cursor = CursorCodec.EncodeTimestamp(timestamp, 42);

        Assert.True(CursorCodec.TryDecodeTimestamp(cursor, out var decoded, out var id));
        Assert.Equal(timestamp, decoded);
        Assert.Equal(42, id);
    }

    [Fact]
    public void Invalid_cursor_is_rejected()
    {
        Assert.False(CursorCodec.TryDecodeTimestamp("not-a-cursor!", out _, out _));
    }

    [Fact]
    public void Empty_cursor_is_valid_start()
    {
        Assert.True(CursorCodec.TryDecodeTimestamp(null, out _, out _));
        Assert.True(CursorCodec.TryDecodeId(null, out _));
    }
}
