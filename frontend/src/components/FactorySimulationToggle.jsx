import { useCallback, useEffect, useState } from 'react';
import { Power } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotify } from '../context/NotificationContext';
import {
  fetchSimulationStatus,
  getApiErrorMessage,
  setSimulationEnabled,
} from '../services/api';

/**
 * Runtime toggle for backend OeeSimulation (independent of operator shift).
 * Admins with simulation.control can flip; others with metrics.read see status only.
 */
const FactorySimulationToggle = ({ compact = false, className = '' }) => {
  const { currentUser } = useAuth();
  const { notify, confirm } = useNotify();
  const [enabled, setEnabled] = useState(null);
  const [busy, setBusy] = useState(false);

  const canControl = Boolean(currentUser?.permissions?.includes('simulation.control'));
  const canRead = Boolean(
    currentUser?.permissions?.includes('metrics.read')
    || currentUser?.permissions?.includes('simulation.control'),
  );

  const loadStatus = useCallback(async (signal) => {
    if (!canRead) return;
    try {
      const status = await fetchSimulationStatus({ signal });
      setEnabled(Boolean(status?.enabled));
    } catch (error) {
      if (error.name !== 'CanceledError' && error.name !== 'AbortError') {
        console.error(error);
      }
    }
  }, [canRead]);

  useEffect(() => {
    if (!canRead) return undefined;
    const controller = new AbortController();
    loadStatus(controller.signal);
    const timer = window.setInterval(() => loadStatus(controller.signal), 15000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [canRead, loadStatus]);

  const handleToggle = async () => {
    if (!canControl || busy || enabled == null) return;
    const next = !enabled;
    if (!next) {
      const ok = await confirm(
        'Fabrika simülasyonunu kapatmak istediğinize emin misiniz? Backend telemetri motoru tick yazmayı durdurur; Andon SİM KAPALI gösterir. Vardiya oturumu etkilenmez.',
      );
      if (!ok) return;
    }

    setBusy(true);
    try {
      const status = await setSimulationEnabled({ enabled: next });
      setEnabled(Boolean(status?.enabled));
      notify(
        next
          ? 'Fabrika simülasyonu açıldı — backend telemetri yazacak.'
          : 'Fabrika simülasyonu kapandı — yeni tick yok.',
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
          ? 'Fabrika simülasyonunu aç/kapa (vardiyadan bağımsız)'
          : 'Fabrika simülasyonu durumu (salt okunur)'}
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
            Vardiya oturumundan bağımsız; backend telemetri motoru.
            {!enabled && ' Andon SİM KAPALI gösterir; vardiya toplamları donar.'}
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
