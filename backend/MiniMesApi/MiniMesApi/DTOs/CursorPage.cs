namespace MiniMesApi.DTOs;

public sealed class CursorPage<T>
{
    public required IReadOnlyCollection<T> Items { get; init; }
    public string? NextCursor { get; init; }
}
