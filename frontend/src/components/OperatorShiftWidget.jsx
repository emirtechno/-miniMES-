import { useState } from 'react';
import { Coffee, PlayCircle, StopCircle, Wrench } from 'lucide-react';
import CardHeader from './CardHeader';
import ShiftStartModal from './ShiftStartModal';
import { useShiftSession } from '../context/ShiftSessionContext';
import { ACTIVE_STATION_DEFINITIONS, getStationDisplayName } from '../constants/stations';
import { getShiftLabel } from '../constants/shifts';
import { formatScrapLabel } from '../utils/scrapLabel';

/**
 * Shop-floor shift status card — start opens structured modal.
 * Supports concurrent shifts on multiple stations/lines.
 */
const OperatorShiftWidget = ({
  user,
  stationId,
  metricsNok = 0,
  onStationChange,
  onEndShift,
  onResume,
}) => {
  const {
    shift,
    elapsedLabel,
    setupElapsedLabel,
    startShift,
    endShift,
    setStationId,
    resumeProduction,
    activeShifts,
    activeShiftCount,
    streamingStationIds,
  } = useShiftSession();
  const [showStartModal, setShowStartModal] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  const finishShift = () => {
    if (typeof onEndShift === 'function') onEndShift();
    else endShift({ metricsNok });
  };

  const handleResumeClick = () => {
    if (typeof onResume === 'function') onResume();
    else resumeProduction();
  };

  const statusLabel = !shift.active
    ? 'Pasif'
    : shift.inSetup
      ? 'Setup / Model Değişimi'
      : shift.onBreak
        ? 'Molada / Duruşta'
        : 'Aktif';

  const otherActive = activeShifts.filter((entry) => entry.stationId !== shift.stationId);

  return (
    <section className="mes-surface p-5">
      <CardHeader
        icon={Wrench}
        title="Operatör Vardiya Kontrolü"
        subtitle={
          shift.active
            ? `${shift.operatorName || user?.name || 'Operatör'} · ${getShiftLabel(shift.shiftCode)} · ${getStationDisplayName(shift.stationId)}`
            : activeShiftCount > 0
              ? `${activeShiftCount} hat aktif — bu istasyon için yeni vardiya başlatabilirsiniz`
              : 'Vardiya başlatmak için formu doldurun (birden fazla hat aynı anda çalışabilir)'
        }
        actions={(
          <>
            {!shift.active ? (
              <button type="button" className="mes-btn-primary" onClick={() => setShowStartModal(true)}>
                <PlayCircle size={16} />
                {activeShiftCount > 0 ? 'Başka Hat Başlat' : 'Vardiya Başlat'}
              </button>
            ) : (
              <>
                <button type="button" className="mes-btn-secondary" onClick={() => setShowStartModal(true)}>
                  <PlayCircle size={16} />
                  Başka Hat Başlat
                </button>
                <button type="button" className="mes-btn-danger" onClick={() => setShowEndConfirm(true)}>
                  <StopCircle size={16} />
                  Vardiya Bitir
                </button>
              </>
            )}
            {shift.active && (shift.onBreak || shift.inSetup) && (
              <button type="button" className="mes-btn-primary" onClick={handleResumeClick}>
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
          {shift.sim && shift.active && (
            <div className="mt-1 text-xs text-sky-800">
              Hedef {shift.sim.targetQuantity} · {shift.sim.lotNo || shift.sim.orderNo}
            </div>
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
          <label className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">Odak İstasyon</label>
          <select
            className="mes-input mt-1"
            value={shift.stationId || stationId}
            onChange={(event) => {
              const next = event.target.value;
              setStationId(next);
              onStationChange?.(next);
            }}
          >
            {ACTIVE_STATION_DEFINITIONS.map((station) => {
              const isLive = streamingStationIds.includes(station.id);
              const isActive = activeShifts.some((entry) => entry.stationId === station.id);
              return (
                <option key={station.id} value={station.id}>
                  {station.displayName}{isLive ? ' ● Canlı' : isActive ? ' ● Aktif' : ''}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {activeShiftCount > 1 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {activeShifts.map((entry) => (
            <button
              key={entry.stationId}
              type="button"
              className={
                entry.stationId === shift.stationId
                  ? 'mes-pill-ok'
                  : 'mes-pill-neutral'
              }
              onClick={() => {
                setStationId(entry.stationId);
                onStationChange?.(entry.stationId);
              }}
              title="Bu hatta odaklan"
            >
              {getStationDisplayName(entry.stationId)}
              {streamingStationIds.includes(entry.stationId) ? ' · stream' : entry.onBreak || entry.inSetup ? ' · durak' : ''}
            </button>
          ))}
        </div>
      )}

      {otherActive.length > 0 && !shift.active && (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-sm text-emerald-950">
          Diğer hatlar çalışıyor: {otherActive.map((entry) => getStationDisplayName(entry.stationId)).join(', ')}
        </div>
      )}

      {shift.summary && !shift.active && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          Son vardiya özeti: {shift.summary.operatorName} · {getStationDisplayName(shift.summary.stationId)} · {shift.summary.durationMinutes} dk
          {' · '}{formatScrapLabel(shift.summary.scrapCount, shift.summary.manualScrapCount || 0)}
        </div>
      )}

      <ShiftStartModal
        open={showStartModal}
        onClose={() => setShowStartModal(false)}
        defaultOperatorName={user?.name || user?.username || shift.operatorName || ''}
        defaultOperatorId={user?.username || shift.operatorId || ''}
        defaultStationId={stationId || shift.stationId}
        occupiedStationIds={activeShifts.map((entry) => entry.stationId)}
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
            <p className="mes-helper">
              Yalnızca <strong>{getStationDisplayName(shift.stationId)}</strong> kapanacak.
              Σ Fire: {metricsNok}
              {(shift.scrapCount || 0) > 0 ? ` · bu vardiyada manuel +${shift.scrapCount}` : ''}
              {otherActive.length > 0
                ? ` · Diğer ${otherActive.length} hat çalışmaya devam eder.`
                : ''}
            </p>
            <div className="confirm-actions">
              <button type="button" className="mes-btn-secondary" onClick={() => setShowEndConfirm(false)}>Vazgeç</button>
              <button
                type="button"
                className="mes-btn-danger"
                onClick={() => {
                  setShowEndConfirm(false);
                  finishShift();
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
