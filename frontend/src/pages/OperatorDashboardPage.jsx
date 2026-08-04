import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, ClipboardList, Factory, History, Package, Radio, StopCircle } from 'lucide-react';
import OperatorShiftWidget from '../components/OperatorShiftWidget';
import ShopFloorActionBar from '../components/ShopFloorActionBar';
import TraceabilityPanel from '../components/TraceabilityPanel';
import CardHeader from '../components/CardHeader';
import { useShiftSession } from '../context/ShiftSessionContext';
import {
  ACTIVE_STATION_DEFINITIONS,
  DEFAULT_STATION,
  PRODUCTION_STATION_IDS,
  getStationDisplayName,
} from '../constants/stations';
import { SHIFT_SCHEDULES, getShiftLabel } from '../constants/shifts';
import { emptyStationKpi } from '../utils/telemetryAggregate';
import { getApiErrorMessage, startFactorySimulation } from '../services/api';

const OperatorDashboardPage = ({
  currentUser,
  notify,
  stationKpi,
  recentTicks = [],
  workOrders = [],
  batches = [],
  liveStreaming = false,
  canIngestTelemetry = false,
  ingestManualScrap,
  ingestDowntimeTick,
  onRefreshOrders,
}) => {
  const {
    shift,
    elapsedLabel,
    setStationId,
    reportDowntime,
    resumeProduction,
    startSetup,
    logScrap,
    loginSecondaryOperator,
    endShift,
    endAllShifts,
    endShiftForStation,
    startAllShifts,
    liveStreamActive: sessionStreaming,
    activeShiftCount,
    streamingStationIds,
    activeShifts,
    factorySimActive,
  } = useShiftSession();

  const [stationId, setLocalStationId] = useState(shift.stationId || DEFAULT_STATION);
  const [startingFactory, setStartingFactory] = useState(false);
  const [showStopAll, setShowStopAll] = useState(false);
  const autoCompletedRef = useRef(new Set());

  useEffect(() => {
    if (shift.stationId && shift.stationId !== stationId) {
      setLocalStationId(shift.stationId);
    }
  }, [shift.stationId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStationChange = (nextStationId) => {
    setLocalStationId(nextStationId);
    setStationId(nextStationId);
  };

  const kpi = stationKpi?.(stationId) || emptyStationKpi(stationId);
  const stationTicks = useMemo(
    () => recentTicks.filter((tick) => tick.stationId === stationId).slice(0, 8),
    [recentTicks, stationId],
  );

  /** Additive: POST MachineMetrics (Actual=N, Good=0) so Σ Fire KPI updates immediately. */
  const handleScrap = async (qty) => {
    if (!shift.active) {
      notify?.('Önce vardiyayı başlatın.', 'error');
      return false;
    }
    if (!canIngestTelemetry || typeof ingestManualScrap !== 'function') {
      notify?.('Fire kaydı için production.write yetkisi gerekir.', 'error');
      return false;
    }
    try {
      const amount = await ingestManualScrap({
        stationId,
        amount: qty,
        shiftCode: shift.shiftCode,
      });
      logScrap(amount, { silent: true });
      notify?.(
        `${amount} adet fire MachineMetrics’e eklendi — Σ Fire ${kpi.nok} → ${kpi.nok + amount}.`,
        'success',
      );
      return true;
    } catch (error) {
      notify?.(getApiErrorMessage(error, 'Fire kaydı yazılamadı.'), 'error');
      return false;
    }
  };

  /** On resume, persist pause duration into MachineMetrics (Availability SSOT). */
  const handleResume = async () => {
    const pauseStart = shift.breakStartedAt || shift.setupStartedAt;
    if (pauseStart && canIngestTelemetry && typeof ingestDowntimeTick === 'function') {
      const secs = Math.max(1, Math.floor((Date.now() - new Date(pauseStart).getTime()) / 1000));
      try {
        await ingestDowntimeTick({
          stationId: shift.stationId || stationId,
          downtimeSeconds: secs,
          reasonCode: shift.breakReason || (shift.inSetup ? 'CHANGEOVER' : 'OTHER'),
          shiftCode: shift.shiftCode,
        });
      } catch (error) {
        notify?.(getApiErrorMessage(error, 'Duruş süresi metrik olarak yazılamadı.'), 'error');
      }
    }
    resumeProduction();
  };

  const handleEndShift = () => {
    endShift({ metricsNok: kpi.nok });
  };

  const activeOrder = workOrders.find(
    (order) => order.station === stationId && order.status !== 'Tamamlandı',
  ) || workOrders.find((order) => order.status !== 'Tamamlandı');

  const stationBatches = useMemo(
    () => batches.filter((batch) => batch.station === stationId),
    [batches, stationId],
  );

  const multiStream = (liveStreaming || sessionStreaming) && streamingStationIds.length > 1;

  const simLines = useMemo(() => {
    return activeShifts
      .filter((entry) => entry.sim)
      .map((entry) => {
        const liveBatch = batches.find((batch) => batch.id === entry.sim.batchId)
          || batches.find((batch) => batch.station === entry.stationId && batch.status !== 'Tamamlandı');
        return {
          stationId: entry.stationId,
          orderNo: entry.sim.orderNo,
          lotNo: entry.sim.lotNo,
          product: entry.sim.product,
          targetQuantity: liveBatch?.targetQuantity ?? entry.sim.targetQuantity,
          producedQuantity: liveBatch?.producedQuantity ?? 0,
          progressPercent: liveBatch?.progressPercent
            ?? (entry.sim.targetQuantity
              ? Math.min(100, Math.round(((liveBatch?.producedQuantity || 0) * 100) / entry.sim.targetQuantity))
              : 0),
          status: liveBatch?.status || entry.sim.batchStatus || 'İşlemde',
        };
      });
  }, [activeShifts, batches]);

  // Auto-complete: when linked lot reaches target, end that line's shift.
  useEffect(() => {
    if (!activeShifts.length) return;

    for (const entry of activeShifts) {
      const batchId = entry.sim?.batchId;
      if (!batchId) continue;
      const doneKey = `${entry.stationId}:${batchId}`;
      if (autoCompletedRef.current.has(doneKey)) continue;

      const batch = batches.find((item) => item.id === batchId);
      if (!batch) continue;

      const reached = batch.status === 'Tamamlandı'
        || (batch.targetQuantity > 0 && batch.producedQuantity >= batch.targetQuantity);
      if (!reached) continue;

      autoCompletedRef.current.add(doneKey);
      const stationKpiRow = stationKpi?.(entry.stationId);
      endShiftForStation(entry.stationId, {
        autoComplete: true,
        metricsNok: stationKpiRow?.nok,
      });
    }
  }, [activeShifts, batches, endShiftForStation, stationKpi]);

  useEffect(() => {
    if (activeShiftCount === 0) {
      autoCompletedRef.current.clear();
    }
  }, [activeShiftCount]);

  const handleStartFactorySimulation = async () => {
    if (!canIngestTelemetry) {
      notify?.('Live Stream / simülasyon için production.write yetkisi gerekir.', 'error');
      return;
    }
    try {
      setStartingFactory(true);
      const result = await startFactorySimulation({
        stationIds: PRODUCTION_STATION_IDS,
        reuseOpenLots: false,
      });
      const lines = result?.lines || [];
      if (lines.length === 0) {
        notify?.(result?.message || 'Simülasyon satırı oluşturulamadı.', 'error');
        return;
      }

      const lineSims = {};
      for (const line of lines) {
        lineSims[line.stationId] = {
          workOrderId: line.workOrderId,
          orderNo: line.orderNo,
          batchId: line.batchId,
          lotNo: line.lotNo,
          product: line.product,
          targetQuantity: line.targetQuantity,
          plannedQuantity: line.plannedQuantity,
          batchStatus: line.batchStatus,
        };
      }

      startAllShifts({
        stationIds: lines.map((line) => line.stationId),
        lineSims,
        factorySim: true,
        silent: true,
        operatorName: currentUser?.name || currentUser?.username || 'Operatör',
        operatorId: currentUser?.username || currentUser?.id || '',
        shiftCode: SHIFT_SCHEDULES[0]?.code,
      });

      notify?.(
        result.message
          || `${lines.length} hat için rastgele iş emri/parti hazır; Live Stream açıldı.`,
        'success',
      );
      await onRefreshOrders?.();
    } catch (error) {
      notify?.(getApiErrorMessage(error, 'Fabrika simülasyonu başlatılamadı.'), 'error');
    } finally {
      setStartingFactory(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <section className="mes-surface p-5">
        <CardHeader
          icon={Package}
          title="Operatör Paneli"
          subtitle="Vardiya → Live Stream → MachineMetrics batch tick’leri. Fabrika simülasyonu tüm üretim hatlarını bir kerede açar."
          actions={(
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="mes-btn-primary"
                disabled={startingFactory || !canIngestTelemetry}
                onClick={handleStartFactorySimulation}
                title="Tüm üretim hatlarında rastgele iş emri + parti oluşturup Live Stream başlatır"
              >
                <Factory size={16} />
                {startingFactory ? 'Başlatılıyor…' : 'Fabrika Simülasyonu Başlat'}
              </button>
              {activeShiftCount > 1 && (
                <button
                  type="button"
                  className="mes-btn-danger"
                  onClick={() => setShowStopAll(true)}
                >
                  <StopCircle size={16} />
                  Tüm Hatları Durdur
                </button>
              )}
              <select
                className="mes-input h-10 w-auto min-w-[200px]"
                value={stationId}
                onChange={(e) => handleStationChange(e.target.value)}
              >
                {ACTIVE_STATION_DEFINITIONS.map((station) => (
                  <option key={station.id} value={station.id}>
                    {station.displayName}
                    {streamingStationIds.includes(station.id) ? ' ●' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        />
        <div
          className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
            liveStreaming || sessionStreaming
              ? 'border-emerald-200 bg-emerald-50/80 text-emerald-950'
              : 'border-[color:var(--color-line)] bg-slate-50 text-[color:var(--color-muted)]'
          }`}
        >
          <span className="inline-flex items-center gap-2 font-semibold">
            <Radio size={16} className={(liveStreaming || sessionStreaming) ? 'animate-pulse' : ''} />
            {multiStream
              ? `Live Stream açık — ${streamingStationIds.length} hat paralel tick yazıyor; batch fire (Actual−Good) Σ Fire’a eklenir.`
              : (liveStreaming || sessionStreaming)
                ? 'Live Stream açık — her tick ~100–140 adet; rastgele batch fire Σ Fire (MachineMetrics) özetine yazılır.'
                : 'Live Stream kapalı — “Vardiya Başlat” veya “Fabrika Simülasyonu Başlat” ile açın.'}
          </span>
          {(liveStreaming || sessionStreaming) && (
            <Link to={`/makine-metrikleri?stationId=${encodeURIComponent(stationId)}`} className="ml-3 underline">
              Makine Metrikleri
            </Link>
          )}
        </div>

        {(factorySimActive || simLines.length > 0) && (
          <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50/80 px-4 py-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-sky-950">
              <Factory size={16} />
              Simülasyon hedefleri (iş emri → parti → hat)
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {simLines.map((line) => (
                <div
                  key={line.stationId}
                  className="rounded-lg border border-sky-100 bg-white/80 px-3 py-2 text-xs text-sky-950"
                >
                  <div className="font-semibold">{getStationDisplayName(line.stationId)}</div>
                  <div className="mt-0.5 text-sky-800">
                    {line.orderNo || '—'} · {line.lotNo || '—'}
                  </div>
                  <div className="mt-1">
                    {line.producedQuantity} / {line.targetQuantity}
                    <span className="ml-2 text-sky-700">%{line.progressPercent}</span>
                  </div>
                  <div className="mt-0.5 truncate text-sky-700">{line.product}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-[color:var(--color-line)] bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">İstasyon</div>
            <div className="font-display mt-1 text-2xl font-semibold">{getStationDisplayName(stationId)}</div>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Σ Sağlam (OK)</div>
            <div className="font-display mt-1 text-3xl font-semibold text-emerald-950">{kpi.good}</div>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50/70 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-red-800">Σ Fire (NOK)</div>
            <div className="font-display mt-1 text-3xl font-semibold text-red-950">{kpi.nok}</div>
            <div className="mt-1 text-xs text-red-800">
              Live Stream + manuel · MachineMetrics
              {(shift.scrapCount || 0) > 0 ? ` · manuel +${shift.scrapCount}` : ''}
            </div>
          </div>
          <div className={`rounded-xl border p-4 ${shift.active || activeShiftCount > 0 ? 'border-sky-200 bg-sky-50/80' : 'border-[color:var(--color-line)] bg-slate-50'}`}>
            <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">Vardiya · Verim</div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className={shift.active ? 'mes-pill-ok' : 'mes-pill-neutral'}>
                {shift.active ? 'Aktif' : activeShiftCount > 0 ? 'Diğer hatlar aktif' : 'Pasif'}
              </span>
              <span className="text-sm font-semibold">%{kpi.yield} · {elapsedLabel}</span>
            </div>
            {shift.active && (
              <div className="mt-1 text-xs text-slate-600">
                {shift.operatorName} · {getShiftLabel(shift.shiftCode)} · Σ {kpi.actual}
              </div>
            )}
            {shift.sim && (
              <div className="mt-1 text-xs text-sky-800">
                Hedef {shift.sim.targetQuantity} · {shift.sim.lotNo}
              </div>
            )}
            {activeShiftCount > 1 && (
              <div className="mt-1 text-xs text-sky-800">{activeShiftCount} hat eşzamanlı</div>
            )}
          </div>
        </div>
      </section>

      <OperatorShiftWidget
        user={currentUser}
        stationId={stationId}
        metricsNok={kpi.nok}
        onStationChange={handleStationChange}
        onEndShift={handleEndShift}
        onResume={handleResume}
      />

      <ShopFloorActionBar
        shift={shift}
        metricsNok={kpi.nok}
        notify={notify}
        onKeypadLogin={loginSecondaryOperator}
        onDowntime={reportDowntime}
        onScrap={handleScrap}
        onSetup={startSetup}
        onEmergency={reportDowntime}
        onEndShift={handleEndShift}
        onResume={handleResume}
      />

      <section className="mes-surface p-5">
        <CardHeader icon={ClipboardList} title="Aktif İş Emri" subtitle="İstasyona bağlı açık iş emri (simülasyon dahil)" />
        {activeOrder ? (
          <div className="grid gap-3 rounded-xl border border-[color:var(--color-line)] bg-slate-50/80 p-4 sm:grid-cols-4">
            <div>
              <div className="text-xs text-[color:var(--color-muted)]">İş Emri</div>
              <div className="font-semibold">{activeOrder.orderNo}</div>
            </div>
            <div>
              <div className="text-xs text-[color:var(--color-muted)]">Ürün</div>
              <div className="font-semibold">{activeOrder.product}</div>
            </div>
            <div>
              <div className="text-xs text-[color:var(--color-muted)]">İstasyon</div>
              <div className="font-semibold">{getStationDisplayName(activeOrder.station)}</div>
            </div>
            <div>
              <div className="text-xs text-[color:var(--color-muted)]">Durum / Miktar</div>
              <div className="font-semibold">{activeOrder.status} · {activeOrder.quantity}</div>
            </div>
          </div>
        ) : (
          <p className="mes-helper mb-0">Bu istasyon için açık iş emri yok. Fabrika simülasyonu ile rastgele talep oluşturulabilir.</p>
        )}
      </section>

      <TraceabilityPanel batches={stationBatches} />

      <section className="mes-surface p-5">
        <CardHeader
          icon={History}
          title="Son PLC Tick’leri"
          subtitle="MachineMetrics batch satırları — fire = Actual−Good (Live Stream + manuel SSOT)"
          actions={(
            <span className="inline-flex items-center gap-1 text-xs text-[color:var(--color-muted)]">
              <Activity size={13} />
              {stationTicks.length} tick
            </span>
          )}
        />
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {stationTicks.map((tick) => {
            const scrap = Math.max(0, (tick.actualProductionCount || 0) - (tick.goodProductionCount || 0));
            return (
              <li key={`${tick.id}-${tick.recordedAt}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[color:var(--color-line)] px-3 py-2 text-sm">
                <span className="font-medium">
                  {tick.actualProductionCount} / {tick.goodProductionCount}
                  {scrap > 0 ? ` · fire ${scrap}` : ''}
                  <span className="ml-2 text-xs text-[color:var(--color-muted)]">duruş {tick.downtimeSeconds}sn</span>
                </span>
                <span className={scrap > 0 ? 'mes-pill-nok' : 'mes-pill-ok'}>
                  {scrap > 0 ? `Fire ${scrap}` : 'OK batch'}
                </span>
              </li>
            );
          })}
          {stationTicks.length === 0 && (
            <li className="text-sm text-[color:var(--color-muted)]">
              Henüz telemetri yok. Vardiya veya fabrika simülasyonu ile Live Stream’i açın.
            </li>
          )}
        </ul>
      </section>

      {showStopAll && (
        <div className="modal-overlay" role="presentation">
          <div className="modal-card confirm-dialog" role="dialog" aria-modal="true">
            <h3>Tüm Hatları Durdur?</h3>
            <p className="mes-helper">
              {activeShiftCount} aktif vardiya kapanacak ve Live Stream duracak.
              Açık iş emri/partiler sunucuda kalır (hedefe ulaşınca tamamlanır).
            </p>
            <div className="confirm-actions">
              <button type="button" className="mes-btn-secondary" onClick={() => setShowStopAll(false)}>Vazgeç</button>
              <button
                type="button"
                className="mes-btn-danger"
                onClick={() => {
                  setShowStopAll(false);
                  const metricsNokByStation = {};
                  for (const entry of activeShifts) {
                    metricsNokByStation[entry.stationId] = stationKpi?.(entry.stationId)?.nok ?? 0;
                  }
                  endAllShifts({ metricsNokByStation });
                }}
              >
                <StopCircle size={16} />
                Tümünü Durdur
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OperatorDashboardPage;
