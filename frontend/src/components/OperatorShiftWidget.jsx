import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Coffee, History, PlayCircle, StopCircle, Wrench } from 'lucide-react';
import CardHeader from './CardHeader';
import ShiftStartModal from './ShiftStartModal';
import { useShiftSession } from '../context/ShiftSessionContext';
import { ACTIVE_STATION_DEFINITIONS, getStationDisplayName } from '../constants/stations';
import { getShiftLabel } from '../constants/shifts';
import { fetchShiftSessionHistory } from '../services/api';

const isRuntimePaused = (mode) => mode === 'Paused' || mode === 'Down';

const tickLooksPaused = (tick) => {
  if (!tick) return false;
  const actual = Number(tick.actualProductionCount ?? tick.actual ?? 0);
  if (actual > 0) return false;
  const reason = (tick.downtimeReasonCode || tick.downtimeReason || '').trim().toLowerCase();
  return Boolean(reason) && reason !== 'yok' && reason !== 'none' && reason !== '—' && reason !== 'duruş yok';
};

const formatWhen = (value) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(value);
  }
};

/**
 * Shop-floor shift status card — start opens structured modal.
 */
const OperatorShiftWidget = ({ user, stationId, onStationChange, latestTick }) => {
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
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const rows = await fetchShiftSessionHistory({ limit: 12 });
      setHistory(Array.isArray(rows) ? rows : []);
    } catch (error) {
      console.warn('Vardiya geçmişi yüklenemedi:', error);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory, shift.active, shift.summary?.endedAt]);

  const simulationPaused = useMemo(() => {
    if (!shift.active || shift.onBreak || shift.inSetup) return false;
    if (isRuntimePaused(shift.runtimeMode)) return true;
    if (shift.hasBlockingAlarms) return true;
    return tickLooksPaused(latestTick);
  }, [latestTick, shift.active, shift.hasBlockingAlarms, shift.inSetup, shift.onBreak, shift.runtimeMode]);

  const showResume = Boolean(shift.active && (shift.onBreak || shift.inSetup || simulationPaused));

  const statusLabel = !shift.active
    ? 'Pasif'
    : shift.inSetup
      ? 'Setup / Model Değişimi'
      : shift.onBreak
        ? 'Molada / Duruşta'
        : simulationPaused
          ? 'Aktif · Simülasyon durakladı'
          : 'Aktif';

  const handleResume = async () => {
    await resumeProduction();
  };

  const summary = shift.summary;

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
          <div className="flex flex-col items-end gap-1">
            <div className="flex flex-wrap items-center justify-end gap-2">
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
              {showResume && (
                <button type="button" className="mes-btn-primary" onClick={handleResume}>
                  <PlayCircle size={16} />
                  {simulationPaused && !shift.onBreak && !shift.inSetup ? 'Simülasyonu sürdür' : 'Üretime Dön'}
                </button>
              )}
              {shift.active && !shift.onBreak && !shift.inSetup && !simulationPaused && (
                <span className="mes-pill-ok">Aktif</span>
              )}
            </div>
          </div>
        )}
      />

      {simulationPaused && (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Vardiya Active ama StationRuntime durakladı
          {shift.pauseReason ? ` (${shift.pauseReason})` : ''}
          {shift.hasBlockingAlarms
            ? ' — açık engelleyici alarm var; Andon’dan çözün veya Simülasyonu sürdür deneyin.'
            : ' — Simülasyonu sürdür ile Running’e alın.'}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[color:var(--color-line)] bg-slate-50/80 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">Durum</div>
          <div className="mt-1 font-semibold">{statusLabel}</div>
          {shift.runtimeMode && (
            <div className="mt-1 text-xs text-[color:var(--color-muted)]">Runtime: {shift.runtimeMode}</div>
          )}
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
          <label className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]" htmlFor="operator-assigned-station">
            Atanan İstasyon
          </label>
          <select
            id="operator-assigned-station"
            className="mes-input mt-1"
            value={shift.stationId || stationId}
            disabled={shift.active}
            title={shift.active ? 'Vardiya bitince istasyon değiştirilebilir' : undefined}
            aria-describedby={shift.active ? 'operator-assigned-station-hint' : undefined}
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
          {shift.active && (
            <p id="operator-assigned-station-hint" className="mes-helper mb-0 mt-1 text-xs">
              Vardiya bitince istasyon değiştirilebilir
            </p>
          )}
        </div>
      </div>

      {summary && !shift.active && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
          <div className="font-semibold text-slate-900">Son vardiya özeti</div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            <span>{summary.operatorName || '—'}</span>
            <span>{getStationDisplayName(summary.stationId)}</span>
            <span>{summary.durationMinutes} dk</span>
            <span className="text-emerald-800">OK {summary.goodCount ?? 0}</span>
            <span className="text-red-800">NOK {summary.nokCount ?? summary.scrapCount ?? 0}</span>
            <span>Fire log {summary.scrapCount ?? 0}</span>
            {typeof summary.oeePercent === 'number' && (
              <span>OEE %{Number(summary.oeePercent).toFixed(1)}</span>
            )}
          </div>
        </div>
      )}

      <div className="mt-4 border-t border-[color:var(--color-line)] pt-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="inline-flex items-center gap-2 text-sm font-semibold">
            <History size={16} />
            Son vardiya oturumları
          </div>
          <button type="button" className="mes-btn-secondary text-xs" onClick={loadHistory} disabled={historyLoading}>
            {historyLoading ? 'Yükleniyor…' : 'Yenile'}
          </button>
        </div>
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {history.map((row) => {
            const open = expandedId === row.id;
            const s = row.summary;
            return (
              <li key={row.id} className="rounded-lg border border-[color:var(--color-line)]">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm"
                  onClick={() => setExpandedId(open ? null : row.id)}
                >
                  <span className="inline-flex items-center gap-2">
                    {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <span className="font-medium">#{row.id}</span>
                    <span>{getStationDisplayName(row.stationId)}</span>
                    <span className="text-[color:var(--color-muted)]">{getShiftLabel(row.shiftCode)}</span>
                  </span>
                  <span className="text-xs text-[color:var(--color-muted)]">
                    {row.status === 'Ended' ? 'Bitti' : row.status}
                    {' · '}
                    {formatWhen(row.startedAt)}
                  </span>
                </button>
                {open && (
                  <div className="border-t border-[color:var(--color-line)] bg-slate-50/80 px-3 py-2 text-xs text-slate-700">
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      <span>Operatör: {row.operatorName || '—'}</span>
                      <span>Süre: {s?.durationMinutes ?? '—'} dk</span>
                      <span>OK: {s?.goodCount ?? 0}</span>
                      <span>NOK: {s?.nokCount ?? 0}</span>
                      <span>Fire: {s?.scrapLogQuantity ?? 0}</span>
                      <span>Duruş: {Number(s?.downtimeSeconds || 0).toFixed(0)} sn</span>
                      <span>
                        OEE:{' '}
                        {typeof s?.oeePercent === 'number' ? `%${Number(s.oeePercent).toFixed(1)}` : '—'}
                      </span>
                    </div>
                    {row.endedAt && (
                      <div className="mt-1 text-[color:var(--color-muted)]">Bitiş: {formatWhen(row.endedAt)}</div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
          {!historyLoading && history.length === 0 && (
            <li className="text-sm text-[color:var(--color-muted)]">Henüz oturum yok.</li>
          )}
        </ul>
      </div>

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
            <p className="mes-helper">Bitirdikten sonra istasyon seçiciden başka hat seçebilirsiniz.</p>
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
