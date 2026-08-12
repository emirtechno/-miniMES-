import { useState } from 'react';
import { Power } from 'lucide-react';
import { useNotify } from '../context/NotificationContext';
import { useSimulationStatus } from '../context/SimulationStatusContext';
import { getApiErrorMessage } from '../services/api';

/**
 * Backend SimulationControls anahtarı (restart sonrası DB'de kalır).
 */
const FactorySimulationToggle = ({ compact = false, className = '' }) => {
  const { notify, confirm } = useNotify();
  const { enabled, canRead, canControl, setEnabledRemote, updatedBy } = useSimulationStatus();
  const [busy, setBusy] = useState(false);

  const handleToggle = async () => {
    if (!canControl || busy || enabled == null) return;
    const next = !enabled;
    if (!next) {
      const ok = await confirm(
        'Fabrika simülasyonunu kapatmak istediğinize emin misiniz? Durum veritabanına yazılır; yeniden başlatınca kapalı kalır.',
      );
      if (!ok) return;
    }

    setBusy(true);
    try {
      await setEnabledRemote(next);
      notify(
        next
          ? 'Fabrika simülasyonu açıldı — durum kaydedildi, yeniden başlatınca açık kalır.'
          : 'Fabrika simülasyonu kapandı — durum kaydedildi, yeniden başlatınca kapalı kalır.',
        'success',
      );
    } catch (error) {
      notify(getApiErrorMessage(error, 'Simülasyon durumu güncellenemedi.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!canRead || enabled == null) return null;

  if (compact) {
    return (
      <button
        type="button"
        className={`${enabled ? 'mes-pill-ok' : 'mes-pill-neutral'} ${canControl ? 'cursor-pointer' : 'cursor-default'} ${className}`}
        title={canControl
          ? `Fabrika simülasyonu (DB’de kalıcı)${updatedBy ? ` · son: ${updatedBy}` : ''}`
          : 'Fabrika simülasyonu durumu (salt okunur, DB’de kalıcı)'}
        disabled={!canControl || busy}
        onClick={canControl ? handleToggle : undefined}
      >
        <Power size={12} />
        Sim {enabled ? 'Açık' : 'Kapalı'}
      </button>
    );
  }

  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm ${
        enabled
          ? 'border-emerald-200 bg-emerald-50/80 text-emerald-950'
          : 'border-amber-200 bg-amber-50/80 text-amber-950'
      } ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 font-semibold">
            <Power size={16} className={enabled ? 'text-emerald-700' : 'text-amber-700'} />
            Fabrika simülasyonu
            <span className={enabled ? 'mes-pill-ok' : 'mes-pill-warn'}>
              {enabled ? 'Açık' : 'Kapalı'}
            </span>
          </div>
          <p className="mes-helper mb-0 mt-1">
            Durum veritabanında saklanır — sayfa yenilense / API yeniden başlasa son seçim korunur.
            {!enabled && ' Andon SİM KAPALI gösterir; yeni tick yazılmaz.'}
          </p>
        </div>
        {canControl ? (
          <button
            type="button"
            className={enabled ? 'mes-btn-secondary' : 'mes-btn-primary'}
            disabled={busy}
            onClick={handleToggle}
          >
            {busy ? 'Kaydediliyor…' : enabled ? 'Kapat' : 'Aç'}
          </button>
        ) : (
          <span className="text-xs text-[color:var(--color-muted)]">Salt okunur</span>
        )}
      </div>
    </div>
  );
};

export default FactorySimulationToggle;
