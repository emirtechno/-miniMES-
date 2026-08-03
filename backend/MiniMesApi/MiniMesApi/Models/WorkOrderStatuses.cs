namespace MiniMesApi.Models;

public static class WorkOrderStatuses
{
    public const string Waiting = "Bekliyor";
    public const string InProgress = "Devam Ediyor";
    public const string Completed = "Tamamlandı";

    public static readonly IReadOnlyCollection<string> All =
    [
        Waiting,
        InProgress,
        Completed
    ];

    public static bool TryAdvance(string currentStatus, out string nextStatus, out string? error)
    {
        nextStatus = currentStatus;
        error = null;

        if (string.Equals(currentStatus, Waiting, StringComparison.Ordinal))
        {
            nextStatus = InProgress;
            return true;
        }

        if (string.Equals(currentStatus, InProgress, StringComparison.Ordinal))
        {
            nextStatus = Completed;
            return true;
        }

        if (string.Equals(currentStatus, Completed, StringComparison.Ordinal))
        {
            error = "Tamamlanmış iş emri ilerletilemez.";
            return false;
        }

        error = "İş emri durumu geçersiz.";
        return false;
    }
}
