import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, ClipboardList, History, Package, Radio } from 'lucide-react';
import OperatorShiftWidget from '../components/OperatorShiftWidget';
import ShopFloorActionBar from '../components/ShopFloorActionBar';
import TraceabilityPanel from '../components/TraceabilityPanel';
import CardHeader from '../components/CardHeader';
import { useShiftSession } from '../context/ShiftSessionContext';
import { ACTIVE_STATION_DEFINITIONS, DEFAULT_STATION, getStationDisplayName } from '../constants/stations';
import { getShiftLabel } from '../constants/shifts';

/**
 * Operator workspace: shift-driven Live Stream, station counters, HMI — no manual barcode entry.
 */
const OperatorDashboardPage = ({
  currentUser,
  notify,
  records = [],
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
  } = useShiftSession();

  const [stationId, setLocalStationId] = useState(shift.stationId || DEFAULT_STATION);

  useEffect(() => {
    if (shift.stationId && shift.stationId !== stationId) {
      setLocalStationId(shift.stationId);
    }
  }, [shift.stationId]); // eslint-disable-line react-hooks/exhaustive-deps -- sync from shift session only

  const handleStationChange = (nextStationId) => {
    setLocalStationId(nextStationId);
    setStationId(nextStationId);
  };

  const stationRecords = useMemo(
    () => records.filter((record) => record.istasyonAdi === stationId),
    [records, stationId],
  );

  const ok = stationRecords.filter((r) => r.kaliteDurumu === 'OK').length;
  const nok = stationRecords.filter((r) => r.kaliteDurumu === 'NOK').length;
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
          subtitle="Vardiya → Live Stream → telemetri / OEE / Andon. Manuel barkod girişi yoktur."
          actions={(
            <select
              className="mes-input h-10 w-auto min-w-[200px]"
              value={stationId}
              disabled={shift.active}
              onChange={(e) => handleStationChange(e.target.value)}
            >
              {ACTIVE_STATION_DEFINITIONS.map((station) => (
                <option key={station.id} value={station.id}>{station.displayName}</option>
              ))}
            </select>
          )}
        />
        <div
          className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
            liveStreaming
              ? 'border-emerald-200 bg-emerald-50/80 text-emerald-950'
              : 'border-[color:var(--color-line)] bg-slate-50 text-[color:var(--color-muted)]'
          }`}
        >
          <span className="inline-flex items-center gap-2 font-semibold">
            <Radio size={16} className={liveStreaming ? 'animate-pulse' : ''} />
            {liveStreaming
              ? 'Live Stream açık — PLC/sensör telemetrisi OK·NOK ve lot ilerlemesini besliyor.'
              : 'Live Stream kapalı — Operatör Shift Widget’tan “Vardiya Başlat” ile telemetri motorunu açın.'}
          </span>
          {liveStreaming && (
            <Link to={`/makine-metrikleri?stationId=${encodeURIComponent(stationId)}`} className="ml-3 underline">
              Makine Metrikleri
            </Link>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-[color:var(--color-line)] bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">İstasyon</div>
            <div className="font-display mt-1 text-2xl font-semibold">{getStationDisplayName(stationId)}</div>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-emerald-800">OK Sayacı</div>
            <div className="font-display mt-1 text-3xl font-semibold text-emerald-950">{ok}</div>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50/70 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-red-800">NOK Sayacı</div>
            <div className="font-display mt-1 text-3xl font-semibold text-red-950">{nok}</div>
          </div>
          <div className={`rounded-xl border p-4 ${shift.active ? 'border-sky-200 bg-sky-50/80' : 'border-[color:var(--color-line)] bg-slate-50'}`}>
            <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">Vardiya</div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className={shift.active ? 'mes-pill-ok' : 'mes-pill-neutral'}>
                {shift.active ? 'Aktif' : 'Pasif'}
              </span>
              <span className="text-sm font-semibold">{elapsedLabel}</span>
            </div>
            {shift.active && (
              <div className="mt-1 text-xs text-slate-600">
                {shift.operatorName} · {getShiftLabel(shift.shiftCode)}
              </div>
            )}
          </div>
        </div>
      </section>

      <OperatorShiftWidget
        user={currentUser}
        stationId={stationId}
        onStationChange={handleStationChange}
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
        <CardHeader
          icon={ClipboardList}
          title="Aktif İş Emri"
          subtitle="İstasyona bağlı açık iş emri"
        />
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

      <TraceabilityPanel batches={stationBatches} />

      <section className="mes-surface p-5">
        <CardHeader
          icon={History}
          title="Son Sensör Olayları"
          subtitle="Live Stream üretim telemetrisi (değiştirilemez kayıtlar)"
          actions={(
            <span className="inline-flex items-center gap-1 text-xs text-[color:var(--color-muted)]">
              <Activity size={13} />
              {stationRecords.length} olay
            </span>
          )}
        />
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {stationRecords.slice(0, 8).map((record) => (
            <li key={record.id} className="flex items-center justify-between rounded-lg border border-[color:var(--color-line)] px-3 py-2 text-sm">
              <span className="truncate font-medium">{record.urun20liKod}</span>
              <span className={record.kaliteDurumu === 'OK' ? 'mes-pill-ok' : 'mes-pill-nok'}>{record.kaliteDurumu}</span>
            </li>
          ))}
          {stationRecords.length === 0 && (
            <li className="text-sm text-[color:var(--color-muted)]">
              Henüz telemetri yok. Vardiya başlatarak Live Stream’i açın.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
};

export default OperatorDashboardPage;
