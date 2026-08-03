import { useState } from 'react';
import { Coffee, PlayCircle, StopCircle, Wrench } from 'lucide-react';
import CardHeader from './CardHeader';
import ShiftStartModal from './ShiftStartModal';
import { useShiftSession } from '../context/ShiftSessionContext';
import { ACTIVE_STATION_DEFINITIONS, getStationDisplayName } from '../constants/stations';
import { getShiftLabel } from '../constants/shifts';

/**
 * Shop-floor shift status card — start opens structured modal.
 */
const OperatorShiftWidget = ({ user, stationId, onStationChange }) => {
  const {
    shift,
    elapsedLabel,
    setupElapsedLabel,
    startShift,
    endShift,
    setStationId,
    resumeProduction,
  } = useShiftSession();
  const [showStartModal, setShowStartModal] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  const statusLabel = !shift.active
    ? 'Pasif'
    : shift.inSetup
      ? 'Setup / Model Değişimi'
      : shift.onBreak
        ? 'Molada / Duruşta'
        : 'Aktif';

  return (
    <section className="mes-surface p-5">
      <CardHeader
        icon={Wrench}
        title="Operatör Vardiya Kontrolü"
        subtitle={
          shift.active
            ? `${shift.operatorName || user?.name || 'Operatör'} · ${getShiftLabel(shift.shiftCode)} · ${getStationDisplayName(shift.stationId)}`
            : 'Vardiya başlatmak için formu doldurun'
        }
        actions={(
          <>
            {!shift.active ? (
              <button type="button" className="mes-btn-primary" onClick={() => setShowStartModal(true)}>
                <PlayCircle size={16} />
                Vardiya Başlat
              </button>
            ) : (
              <button type="button" className="mes-btn-danger" onClick={() => setShowEndConfirm(true)}>
                <StopCircle size={16} />
                Vardiya Bitir
              </button>
            )}
            {shift.active && (shift.onBreak || shift.inSetup) && (
              <button type="button" className="mes-btn-primary" onClick={resumeProduction}>
                <PlayCircle size={16} />
                Üretime Dön
              </button>
            )}
            {shift.active && !shift.onBreak && !shift.inSetup && (
              <span className="mes-pill-ok">Aktif</span>
            )}
          </>
        )}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[color:var(--color-line)] bg-slate-50/80 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">Durum</div>
          <div className="mt-1 font-semibold">{statusLabel}</div>
        </div>
        <div className="rounded-xl border border-[color:var(--color-line)] bg-slate-50/80 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">Uptime</div>
          <div className="mt-1 font-semibold">{elapsedLabel}</div>
          {setupElapsedLabel && (
            <div className="mt-1 text-xs text-amber-800">Setup: {setupElapsedLabel}</div>
          )}
        </div>
        <div className="rounded-xl border border-[color:var(--color-line)] bg-slate-50/80 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">Operatör</div>
          <div className="mt-1 font-semibold">{shift.active ? (shift.operatorName || '—') : '—'}</div>
          {shift.operatorId && shift.active && (
            <div className="text-xs text-[color:var(--color-muted)]">{shift.operatorId}</div>
          )}
          {shift.secondaryOperator && (
            <div className="mt-1 text-xs text-sky-800">+ {shift.secondaryOperator.name}</div>
          )}
        </div>
        <div className="rounded-xl border border-[color:var(--color-line)] bg-slate-50/80 p-3">
          <label className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">Atanan İstasyon</label>
          <select
            className="mes-input mt-1"
            value={shift.stationId || stationId}
            disabled={shift.active}
            onChange={(event) => {
              const next = event.target.value;
              setStationId(next);
              onStationChange?.(next);
            }}
          >
            {ACTIVE_STATION_DEFINITIONS.map((station) => (
              <option key={station.id} value={station.id}>{station.displayName}</option>
            ))}
          </select>
        </div>
      </div>

      {shift.summary && !shift.active && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          Son vardiya özeti: {shift.summary.operatorName} · {shift.summary.durationMinutes} dk · Fire {shift.summary.scrapCount}
        </div>
      )}

      <ShiftStartModal
        open={showStartModal}
        onClose={() => setShowStartModal(false)}
        defaultOperatorName={user?.name || user?.username || ''}
        defaultOperatorId={user?.username || ''}
        defaultStationId={stationId || shift.stationId}
        onSubmit={(payload) => {
          startShift(payload);
          onStationChange?.(payload.stationId);
          setShowStartModal(false);
        }}
      />

      {showEndConfirm && (
        <div className="modal-overlay" role="presentation">
          <div className="modal-card confirm-dialog" role="dialog" aria-modal="true">
            <h3>Vardiyayı Bitir?</h3>
            <p className="mes-helper">Aktif oturum kapanacak. Fire: {shift.scrapCount || 0}</p>
            <div className="confirm-actions">
              <button type="button" className="mes-btn-secondary" onClick={() => setShowEndConfirm(false)}>Vazgeç</button>
              <button
                type="button"
                className="mes-btn-danger"
                onClick={() => {
                  setShowEndConfirm(false);
                  endShift();
                }}
              >
                <Coffee size={16} />
                Bitir
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default OperatorShiftWidget;
