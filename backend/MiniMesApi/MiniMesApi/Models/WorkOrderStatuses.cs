namespace MiniMesApi.Models;

// NEDEN: İş emri yaşam döngüsü sabitleri tek yerde — UI, sync ve API aynı Türkçe etiketleri kullanır.
// Akış: Bekliyor → Devam Ediyor → Tamamlandı → Arşivlendi. Soft-delete ayrı (DeletedAt), status değil.
public static class WorkOrderStatuses
{
    public const string Waiting = "Bekliyor";
    public const string InProgress = "Devam Ediyor";
    public const string Completed = "Tamamlandı";
    public const string Archived = "Arşivlendi";

    public static readonly IReadOnlyCollection<string> All =
    [
        Waiting,
        InProgress,
        Completed,
        Archived
    ];

    // NEDEN: Aktif İş Emri Takibi panosunda Arşivlendi (plan geçmişi) gösterilmez.
    public static bool IsActiveBoard(string? status) =>
        !string.Equals(status, Archived, StringComparison.Ordinal);

    // NEDEN: Soft-delete satırlar aktif/geçmiş listelerinden ve ProductionProgressSync'ten gizlenir.
    public static bool IsVisible(DateTimeOffset? deletedAt) => deletedAt is null;

    // NEDEN: advance endpoint tek adım ilerletir; Arşivlendi son durum (geri advance yok — restore ayrı).
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
            nextStatus = Archived;
            return true;
        }

        if (string.Equals(currentStatus, Archived, StringComparison.Ordinal))
        {
            error = "Arşivlenmiş iş emri ilerletilemez.";
            return false;
        }

        error = "İş emri durumu geçersiz.";
        return false;
    }

    // NEDEN: Arşivlendi → Tamamlandı (geçmişten aktif plana geri alma).
    public static bool TryRestore(string currentStatus, out string nextStatus, out string? error)
    {
        nextStatus = currentStatus;
        error = null;

        if (string.Equals(currentStatus, Archived, StringComparison.Ordinal))
        {
            nextStatus = Completed;
            return true;
        }

        error = "Yalnızca arşivlenmiş iş emirleri geri alınabilir.";
        return false;
    }
}
