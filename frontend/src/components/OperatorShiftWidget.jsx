import { useEffect, useMemo, useState } from 'react';
import { Coffee, PlayCircle, StopCircle, Wrench } from 'lucide-react';
import CardHeader from './CardHeader';
import { createAlarm, fetchDowntimeReasons } from '../services/api';
import { ACTIVE_STATION_DEFINITIONS, DEFAULT_STATION, getStationDisplayName } from '../constants/stations';

const storageKey = (userId) => `mm_operator_shift_${userId || 'anon'}`;

const defaultShift = (stationId) => ({
  active: false,
  onBreak: false,
  stationId: stationId || DEFAULT_STATION,
  startedAt: null,
  breakReason: null,
  breakStartedAt: null,
});

/**
 * Shop-floor shift controls with session persistence + downtime alarm sync.
 */
const OperatorShiftWidget = ({ user, notify, canCreateAlarms, stationId, onStationChange }) => {
  const [shift, setShift] = useState(() => {
    try {
      const raw = sessionStorage.getItem(storageKey(user?.id));
      const restored = raw ? { ...defaultShift(), ...JSON.parse(raw) } : defaultShift(stationId || DEFAULT_STATION);
      if (stationId) restored.stationId = stationId;
      return restored;
    } catch {
      return defaultShift(stationId || DEFAULT_STATION);
    }
  });
  const [reasons, setReasons] = useState([]);
  const [showBreakModal, setShowBreakModal] = useState(false);
  const [selectedReason, setSelectedReason] = useState('CHANGEOVER');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (stationId && stationId !== shift.stationId && !shift.active) {
      setShift((current) => ({ ...current, stationId }));
    }
  }, [stationId, shift.stationId, shift.active]);

  useEffect(() => {
    sessionStorage.setItem(storageKey(user?.id), JSON.stringify(shift));
  }, [shift, user?.id]);

  useEffect(() => {
    const controller = new AbortController();
    fetchDowntimeReasons({ signal: controller.signal })
      .then((items) => {
        const usable = (items || []).filter((item) => item.code && item.code !== 'NONE');
        setReasons(usable);
        if (usable[0]?.code) setSelectedReason(usable[0].code);
      })
      .catch(() => {
        setReasons([
          { code: 'CHANGEOVER', name: 'Model/hat değişimi', isPlanned: true },
          { code: 'PLANNED_MAINTENANCE', name: 'Planlı bakım', isPlanned: true },
          { code: 'BREAKDOWN', name: 'Arıza', isPlanned: false },
          { code: 'MATERIAL_SHORTAGE', name: 'Malzeme eksikliği', isPlanned: false },
          { code: 'NO_OPERATOR', name: 'Operatör yok / mola', isPlanned: false },
        ]);
      });
    return () => controller.abort();
  }, []);

  const [nowTick, setNowTick] = useState(0);

  useEffect(() => {
    setNowTick(Date.now());
    const timer = window.setInterval(() => setNowTick(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const elapsed = useMemo(() => {
    if (!shift.active || !shift.startedAt) return '—';
    const mins = Math.max(0, Math.floor((nowTick - new Date(shift.startedAt).getTime()) / 60000));
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}sa ${m}dk`;
  }, [shift.active, shift.startedAt, nowTick]);

  const startShift = () => {
    setShift((current) => ({
      ...current,
      active: true,
      onBreak: false,
      startedAt: new Date().toISOString(),
      breakReason: null,
      breakStartedAt: null,
    }));
    notify?.('Vardiya başlatıldı.', 'success');
  };

  const endShift = () => {
    setShift((current) => ({
      ...defaultShift(current.stationId),
      stationId: current.stationId,
    }));
    notify?.('Vardiya sonlandırıldı.', 'info');
  };

  const reportBreak = async () => {
    if (!shift.active) {
      notify?.('Önce vardiyayı başlatın.', 'error');
      return;
    }
    setBusy(true);
    try {
      const reason = reasons.find((item) => item.code === selectedReason);
      if (canCreateAlarms) {
        await createAlarm({
          title: `Duruş Bildirimi — ${reason?.name || selectedReason}`,
          station: shift.stationId,
          severity: reason?.isPlanned ? 'Uyarı' : 'Yüksek',
          description: `Operatör ${user?.name || user?.username || ''} duruş kaydı oluşturdu.`,
        });
      } else {
        notify?.('Alarm yazma yetkisi yok — mola yerel olarak işaretlendi.', 'info');
      }
      setShift((current) => ({
        ...current,
        onBreak: true,
        breakReason: selectedReason,
        breakStartedAt: new Date().toISOString(),
      }));
      setShowBreakModal(false);
      notify?.('Duruş / mola kaydı alındı.', 'success');
    } catch (error) {
      notify?.(error?.message || 'Duruş kaydı oluşturulamadı.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const resumeFromBreak = () => {
    setShift((current) => ({
      ...current,
      onBreak: false,
      breakReason: null,
      breakStartedAt: null,
    }));
    notify?.('Üretime geri dönüldü.', 'success');
  };

  return (
    <section className="mes-surface p-5">
      <CardHeader
        icon={Wrench}
        title="Operatör Vardiya Kontrolü"
        subtitle={`${user?.name || user?.username || 'Operatör'} · ${getStationDisplayName(shift.stationId)}`}
        actions={(
          <>
            {!shift.active ? (
              <button type="button" className="mes-btn-primary" onClick={startShift}>
                <PlayCircle size={16} />
                Vardiya Başlat
              </button>
            ) : (
              <button type="button" className="mes-btn-danger" onClick={endShift}>
                <StopCircle size={16} />
                Vardiya Bitir
              </button>
            )}
            {shift.active && !shift.onBreak && (
              <button type="button" className="mes-btn-secondary" onClick={() => setShowBreakModal(true)}>
                <Coffee size={16} />
                Mola / Duruş Bildir
              </button>
            )}
            {shift.active && shift.onBreak && (
              <button type="button" className="mes-btn-primary" onClick={resumeFromBreak}>
                <PlayCircle size={16} />
                Üretime Dön
              </button>
            )}
          </>
        )}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[color:var(--color-line)] bg-slate-50/80 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">Durum</div>
          <div className="mt-1 font-semibold">
            {!shift.active ? 'Pasif' : shift.onBreak ? 'Molada / Duruşta' : 'Aktif Üretim'}
          </div>
        </div>
        <div className="rounded-xl border border-[color:var(--color-line)] bg-slate-50/80 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">Süre</div>
          <div className="mt-1 font-semibold">{elapsed}</div>
        </div>
        <div className="rounded-xl border border-[color:var(--color-line)] bg-slate-50/80 p-3 sm:col-span-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">Atanan İstasyon</label>
          <select
            className="mes-input mt-1"
            value={shift.stationId}
            disabled={shift.active}
            onChange={(event) => {
              const next = event.target.value;
              setShift((current) => ({ ...current, stationId: next }));
              onStationChange?.(next);
            }}
          >
            {ACTIVE_STATION_DEFINITIONS.map((station) => (
              <option key={station.id} value={station.id}>{station.displayName}</option>
            ))}
          </select>
        </div>
      </div>

      {showBreakModal && (
        <div className="modal-overlay" role="presentation">
          <div className="modal-card confirm-dialog" role="dialog" aria-modal="true">
            <h3>Mola / Duruş Bildir</h3>
            <p className="mes-helper">Neden seçin — kayıt alarm olarak kalite ekranına düşer.</p>
            <select className="mes-input" value={selectedReason} onChange={(event) => setSelectedReason(event.target.value)}>
              {reasons.map((reason) => (
                <option key={reason.code} value={reason.code}>
                  {reason.name}{reason.isPlanned ? ' (planlı)' : ''}
                </option>
              ))}
            </select>
            <div className="confirm-actions">
              <button type="button" className="mes-btn-secondary" onClick={() => setShowBreakModal(false)}>Vazgeç</button>
              <button type="button" className="mes-btn-primary" disabled={busy} onClick={reportBreak}>Kaydet</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default OperatorShiftWidget;
