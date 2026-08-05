import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, ClipboardList, History, Package, Radio } from 'lucide-react';
import OperatorShiftWidget from '../components/OperatorShiftWidget';
import ShopFloorActionBar from '../components/ShopFloorActionBar';
import TraceabilityPanel from '../components/TraceabilityPanel';
import FactorySimulationToggle from '../components/FactorySimulationToggle';
import CardHeader from '../components/CardHeader';
import { useShiftSession } from '../context/ShiftSessionContext';
import { ACTIVE_STATION_DEFINITIONS, DEFAULT_STATION, getStationDisplayName } from '../constants/stations';
import { getShiftLabel } from '../constants/shifts';
import { useNonOverlappingPolling } from '../hooks/useNonOverlappingPolling';
import { useMesHub } from '../hooks/useMesHub';
import { emptyStationKpi, kpiFromSessionSummary } from '../utils/telemetryAggregate';

const OperatorDashboardPage = ({
  currentUser,
  notify,
  recentTicks = [],
  workOrders = [],
  batches = [],
  liveStreaming = false,
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
    refreshShift,
  } = useShiftSession();

  const [stationId, setLocalStationId] = useState(shift.stationId || DEFAULT_STATION);

  useEffect(() => {
    if (shift.stationId && shift.stationId !== stationId) {
      setLocalStationId(shift.stationId);
    }
  }, [shift.stationId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStationChange = (nextStationId) => {
    setLocalStationId(nextStationId);
    setStationId(nextStationId);
  };

  const refreshActiveSession = useCallback(async () => {
    if (!shift.active) return;
    await refreshShift();
  }, [refreshShift, shift.active]);

  useNonOverlappingPolling(refreshActiveSession, {
    enabled: Boolean(shift.active),
    intervalMs: liveStreaming ? 8000 : 20000,
    resetKey: `${shift.id || 'none'}:${liveStreaming}`,
  });

  useMesHub({
    onOeeUpdated: () => {
      refreshActiveSession();
    },
    onTelemetryTick: () => {
      refreshActiveSession();
    },
  });

  // Operator KPIs are session-scoped (not catalog /Oee/shift-current).
  const kpi = useMemo(() => {
    if (shift.active) {
      return kpiFromSessionSummary(shift.summary, shift.stationId || stationId);
    }
    if (shift.summary) {
      return kpiFromSessionSummary(shift.summary, shift.summary.stationId || stationId);
    }
    return emptyStationKpi(stationId);
  }, [shift.active, shift.stationId, shift.summary, stationId]);

  const oeePercent = typeof kpi.oee === 'number' ? kpi.oee : null;

  const stationTicks = useMemo(
    () => recentTicks.filter((tick) => tick.stationId === stationId).slice(0, 8),
    [recentTicks, stationId],
  );

  const activeOrder = workOrders.find(
    (order) => order.station === stationId && order.status !== 'Tamamlandı',
  ) || workOrders.find((order) => order.status !== 'Tamamlandı');

  const stationBatches = useMemo(
    () => batches.filter((batch) => batch.station === stationId),
    [batches, stationId],
  );

  return (
    <div className="flex flex-col gap-5">
      <section className="mes-surface p-5">
        <CardHeader
          icon={Package}
          title="Operatör Paneli"
          subtitle="Σ Good/NOK/Verim = bu operatör oturumu (ShiftSession). Andon / İstasyonlar katalog vardiyada birikir; burada Vardiya Başlat ile sıfırdan başlar."
          actions={(
            <div className="flex max-w-[240px] flex-col items-end gap-1">
              <select
                className="mes-input h-10 w-auto min-w-[200px]"
                value={stationId}
                disabled={shift.active}
                title={shift.active ? 'Vardiya bitince istasyon değiştirilebilir' : undefined}
                onChange={(e) => handleStationChange(e.target.value)}
              >
                {ACTIVE_STATION_DEFINITIONS.map((station) => (
                  <option key={station.id} value={station.id}>{station.displayName}</option>
                ))}
              </select>
            </div>
          )}
        />
        <div
          className={`mb-3 rounded-xl border px-4 py-3 text-sm ${
            liveStreaming
              ? 'border-emerald-200 bg-emerald-50/80 text-emerald-950'
              : 'border-[color:var(--color-line)] bg-slate-50 text-[color:var(--color-muted)]'
          }`}
        >
          <span className="inline-flex items-center gap-2 font-semibold">
            <Radio size={16} className={liveStreaming ? 'animate-pulse' : ''} />
            {liveStreaming
              ? 'Vardiya aktif — lot/OEE senkron. Telemetri motoru aşağıda ayrı kontrol edilir.'
              : 'Vardiya kapalı — “Vardiya Başlat” ile oturum açın (KPI sıfırdan başlar).'}
          </span>
          {liveStreaming && (
            <Link to={`/makine-metrikleri?stationId=${encodeURIComponent(stationId)}`} className="ml-3 underline">
              Makine Metrikleri
            </Link>
          )}
        </div>
        <FactorySimulationToggle className="mb-4" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-[color:var(--color-line)] bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">İstasyon</div>
            <div className="font-display mt-1 text-2xl font-semibold">{getStationDisplayName(stationId)}</div>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Oturum Σ Sağlam</div>
            <div className="font-display mt-1 text-3xl font-semibold text-emerald-950">{kpi.good}</div>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50/70 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-red-800">Oturum Σ Fire</div>
            <div className="font-display mt-1 text-3xl font-semibold text-red-950">{kpi.nok}</div>
          </div>
          <div className={`rounded-xl border p-4 ${shift.active ? 'border-sky-200 bg-sky-50/80' : 'border-[color:var(--color-line)] bg-slate-50'}`}>
            <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">Oturum · Verim</div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className={shift.active ? 'mes-pill-ok' : 'mes-pill-neutral'}>
                {shift.active ? 'Aktif' : 'Pasif'}
              </span>
              <span className="text-sm font-semibold">
                {oeePercent == null ? '—' : `%${Number(oeePercent).toFixed(1)}`}
                {' · '}
                {elapsedLabel}
              </span>
            </div>
            {shift.active && (
              <div className="mt-1 text-xs text-slate-600">
                {shift.operatorName} · {getShiftLabel(shift.shiftCode)} · Σ {kpi.actual}
                {' · oturum '}
                #{shift.id}
              </div>
            )}
            {!shift.active && shift.summary && (
              <div className="mt-1 text-xs text-slate-600">
                Son oturum özeti · {shift.summary.durationMinutes} dk
              </div>
            )}
          </div>
        </div>
      </section>

      <OperatorShiftWidget
        user={currentUser}
        stationId={stationId}
        onStationChange={handleStationChange}
        latestTick={stationTicks[0]}
      />

      <ShopFloorActionBar
        shift={shift}
        notify={notify}
        onKeypadLogin={loginSecondaryOperator}
        onDowntime={reportDowntime}
        onScrap={logScrap}
        onSetup={startSetup}
        onEmergency={reportDowntime}
        onEndShift={endShift}
        onResume={resumeProduction}
      />

      <section className="mes-surface p-5">
        <CardHeader icon={ClipboardList} title="Aktif İş Emri" subtitle="İstasyona bağlı açık iş emri" />
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
          <p className="mes-helper mb-0">Bu istasyon için açık iş emri yok.</p>
        )}
      </section>

      <TraceabilityPanel
        batches={stationBatches}
        subtitle={`${getStationDisplayName(stationId)} lotları (shop-floor). Tam izlenebilirlik: Kalite.`}
      />

      <section className="mes-surface p-5">
        <CardHeader
          icon={History}
          title="Son PLC Tick’leri"
          subtitle="MachineMetrics batch satırları (Gerçekleşen / Sağlam / Duruş)"
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
              Henüz telemetri yok. Vardiya başlatın; backend Fabrika Telemetrisi tick yazınca burada görünür.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
};

export default OperatorDashboardPage;
