namespace MiniMesApi.Models;

public static class BatchStatuses
{
    public const string Waiting = "Bekliyor";
    public const string InProgress = "İşlemde";
    public const string Completed = "Tamamlandı";

    public static readonly string[] All = [Waiting, InProgress, Completed];

    public static bool TryAdvance(string current, out string next, out string? error)
    {
        next = current;
        error = null;
        if (current == Waiting)
        {
            next = InProgress;
            return true;
        }

        if (current == InProgress)
        {
            next = Completed;
            return true;
        }

        if (current == Completed)
        {
            error = "Tamamlanan parti ilerletilemez. Geri Al ile yeniden açın.";
            return false;
        }

        error = $"Geçersiz parti durumu: {current}";
        return false;
    }

    public static bool TryReopen(string current, out string next, out string? error)
    {
        next = current;
        error = null;
        if (current != Completed)
        {
            error = "Yalnızca Tamamlandı durumundaki partiler geri alınabilir.";
            return false;
        }

        next = InProgress;
        return true;
    }
}
