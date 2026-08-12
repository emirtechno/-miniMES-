import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, ClipboardList, Factory, Gauge } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import OeePanel from '../components/OeePanel';
import CardHeader from '../components/CardHeader';
import FactorySimulationToggle from '../components/FactorySimulationToggle';
import { fetchShiftCurrentOeeAll } from '../services/api';
import { useMesHub } from '../hooks/useMesHub';
import { ACTIVE_STATION_DEFINITIONS, DEFAULT_STATION, getStationDisplayName } from '../constants/stations';
import { kpiFromShiftOee, mapShiftOeeByStation } from '../utils/telemetryAggregate';
import { OEE_METRIC_TIPS } from '../constants/oeeMetricTips';

const STICKY_SCROLL_OFFSET_PX = 12;

/** Hedefi yalnızca `.mes-content` içinde kaydır (asla window scrollIntoView değil). */
const scrollIntoMesContent = (target) => {
  if (!target) return;
  const scroller = target.closest('.mes-content')
    || document.querySelector('.mes-content');
  if (!scroller) return;

  if (window.scrollY !== 0) window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;

  const targetRect = target.getBoundingClientRect();
  const scrollerRect = scroller.getBoundingClientRect();
  const nextTop = scroller.scrollTop + (targetRect.top - scrollerRect.top) - STICKY_SCROLL_OFFSET_PX;
  const maxTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
  const clamped = Math.min(Math.max(0, nextTop), maxTop);
  scroller.scrollTo({ top: clamped, behavior: 'smooth' });
};

const toneForOee = (value) => {
  if (value == null) return 'idle';
  if (value >= 85) return 'good';
  if (value >= 60) return 'warn';
  return 'bad';
};

/**
 * Fabrika yönetici komuta merkezi: fabrika geneli vardiya penceresi OEE ve çok hatlı durum zaman çizelgesi.
 */
const PlantOverviewPage = ({
  workOrders = [],
  liveStreaming = false,
}) => {
  const [oeeByStation, setOeeByStation] = useState({});
  const [focusStation, setFocusStation] = useState(DEFAULT_STATION);
  const plantSummaryRef = useRef(null);
  const stationFocusRef = useRef(null);

  const applyShiftOee = useCallback((rows) => {
    setOeeByStation(mapShiftOeeByStation(rows));
  }, []);

  const loadShiftOee = useCallback(async (signal) => {
    try {
      applyShiftOee(await fetchShiftCurrentOeeAll({ signal }));
    } catch (error) {
      if (error.name !== 'CanceledError' && error.name !== 'AbortError') {
        console.error(error);
      }
    }
  }, [applyShiftOee]);

  useEffect(() => {
    const controller = new AbortController();
    loadShiftOee(controller.signal);
    return () => controller.abort();
  }, [loadShiftOee, liveStreaming]);

  useMesHub({
    onOeeUpdated: () => {
      loadShiftOee(undefined);
    },
  });

  const handleFocusStationChange = useCallback((nextId) => {
    setFocusStation(nextId);
    window.requestAnimationFrame(() => {
      if (nextId === 'Tümü') {
        scrollIntoMesContent(plantSummaryRef.current || document.getElementById('plant-summary'));
        return;
      }
      scrollIntoMesContent(stationFocusRef.current || document.getElementById('plant-station-focus'));
    });
  }, []);

  const plantAverage = useMemo(() => {
    const values = Object.values(oeeByStation)
      .map((item) => item?.oee)
      .filter((value) => typeof value === 'number');
    if (!values.length) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }, [oeeByStation]);

  const plantTotals = useMemo(() => {
    let good = 0;
    let nok = 0;
    for (const metric of Object.values(oeeByStation)) {
      const kpi = kpiFromShiftOee(metric);
      good += kpi.good;
      nok += kpi.nok;
    }
    return { good, nok };
  }, [oeeByStation]);

  const volumeData = useMemo(
    () => ACTIVE_STATION_DEFINITIONS.map((station) => {
      const kpi = kpiFromShiftOee(oeeByStation[station.id], station.id);
      return {
        name: station.displayName,
        OK: kpi.good,
        NOK: kpi.nok,
      };
    }).filter((row) => row.OK > 0 || row.NOK > 0),
    [oeeByStation],
  );

  const activeWo = workOrders.filter(
    (order) => order.status !== 'Tamamlandı' && order.status !== 'Arşivlendi',
  ).length;

  return (
    <div className="flex flex-col gap-5">
      <section id="plant-summary" ref={plantSummaryRef} className="mes-surface p-5">
        <CardHeader
          icon={Factory}
          title="Fabrika Genel Bakış · Ana Merkez"
          subtitle="Katalog vardiya penceresi (/Oee/shift-current) — hat OEE / OK/NOK (Andon ile aynı). Operatör oturumu burayı sıfırlamaz."
          actions={(
            <select
              className="mes-input h-10 w-auto min-w-[200px]"
              value={focusStation}
              onChange={(e) => handleFocusStationChange(e.target.value)}
              aria-label="Odak istasyon seçimi"
            >
              {ACTIVE_STATION_DEFINITIONS.map((station) => (
                <option key={station.id} value={station.id}>{station.displayName}</option>
              ))}
            </select>
          )}
        />
        <FactorySimulationToggle className="mb-4" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-4" title={`${OEE_METRIC_TIPS.catalogOee} ${OEE_METRIC_TIPS.oee}`} style={{ cursor: 'help' }}>
            <div className="text-xs font-semibold uppercase tracking-wide text-sky-800">Ortalama OEE</div>
            <div className="font-display mt-1 text-3xl font-semibold text-sky-950">
              {plantAverage == null ? '—' : `%${plantAverage.toFixed(1)}`}
            </div>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4" title={OEE_METRIC_TIPS.goodScrap} style={{ cursor: 'help' }}>
            <div className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Σ Sağlam (OK)</div>
            <div className="font-display mt-1 text-3xl font-semibold text-emerald-950">{plantTotals.good}</div>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50/70 p-4" title={OEE_METRIC_TIPS.goodScrap} style={{ cursor: 'help' }}>
            <div className="text-xs font-semibold uppercase tracking-wide text-red-800">Σ Fire (NOK)</div>
            <div className="font-display mt-1 text-3xl font-semibold text-red-950">{plantTotals.nok}</div>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4" title={OEE_METRIC_TIPS.openWorkOrders} style={{ cursor: 'help' }}>
            <div className="text-xs font-semibold uppercase tracking-wide text-amber-900">Açık İş Emri</div>
            <div className="font-display mt-1 text-3xl font-semibold text-amber-950">{activeWo}</div>
          </div>
        </div>
      </section>

      <div id="plant-station-focus" ref={stationFocusRef} className="flex flex-col gap-5">
        <section className="mes-surface p-5">
          <CardHeader icon={Activity} title="Hat Durum Şeridi" subtitle="Idle / Production / Setup / Standstill özeti (vardiya OEE + kalite)" />
          <div className="grid gap-3">
            {ACTIVE_STATION_DEFINITIONS.map((station) => {
              const metric = oeeByStation[station.id];
              const oee = metric?.oee;
              const tone = toneForOee(oee);
              const kpi = kpiFromShiftOee(metric, station.id);
              const nokRatio = kpi.actual
                ? (kpi.nok || 0) / kpi.actual
                : 0;
              const isFocused = focusStation === station.id;
              const segments = [
                { key: 'prod', label: 'Production', flex: tone === 'good' ? 5 : tone === 'warn' ? 3 : 2, color: '#0f9f6e' },
                { key: 'setup', label: 'Setup', flex: metric?.isPlannedDowntime ? 2 : 1, color: '#c47f17' },
                { key: 'stand', label: 'Standstill', flex: tone === 'bad' || nokRatio > 0.2 ? 2 : 0.6, color: '#d92d20' },
                { key: 'idle', label: 'Idle', flex: oee == null ? 4 : 1, color: '#94a3b8' },
              ];
              return (
                <div
                  key={station.id}
                  className={`rounded-xl border p-3 ${
                    isFocused
                      ? 'border-sky-400 bg-sky-50/50 ring-1 ring-sky-200'
                      : 'border-[color:var(--color-line)]'
                  }`}
                >
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold text-[color:var(--color-ink)]">{station.displayName}</div>
                      <div className="text-xs text-[color:var(--color-muted)]">{station.line} · {metric?.shiftName || metric?.shiftCode || 'Vardiya yok'}</div>
                    </div>
                    <span className={tone === 'good' ? 'mes-pill-ok' : tone === 'warn' ? 'mes-pill-warn' : tone === 'bad' ? 'mes-pill-nok' : 'mes-pill-neutral'}>
                      OEE {oee == null ? '—' : `%${Number(oee).toFixed(1)}`}
                    </span>
                  </div>
                  <div className="flex h-3 overflow-hidden rounded-full bg-slate-100" title="Durum zaman şeridi">
                    {segments.map((segment) => (
                      <div
                        key={segment.key}
                        style={{ flex: segment.flex, background: segment.color }}
                        title={segment.label}
                      />
                    ))}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-[color:var(--color-muted)]">
                    <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-600" />Production</span>
                    <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-600" />Setup</span>
                    <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-red-600" />Standstill</span>
                    <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-slate-400" />Idle</span>
                    <span className="ml-auto">Σ {kpi.good} OK · {kpi.nok} NOK</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-2">
          <OeePanel
            stationId={focusStation}
            onStationChange={setFocusStation}
            showStationSelector
          />
          <section className="mes-surface p-5">
            <CardHeader icon={Gauge} title="İstasyon Bazlı Üretim Hacmi" subtitle="Aktif vardiya penceresi OK / NOK" />
            <div className="h-[360px]">
              {volumeData.length === 0 ? (
                <p className="pt-20 text-center text-[color:var(--color-muted)]">Hacim verisi yok.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={volumeData} margin={{ top: 28, right: 12, left: 0, bottom: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis
                      dataKey="name"
                      interval={0}
                      angle={-30}
                      textAnchor="end"
                      height={72}
                      tick={{ fontSize: 10, fill: '#5b6b7c' }}
                      tickMargin={8}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#5b6b7c' }} width={36} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #d7dee8' }} />
                    <Legend verticalAlign="top" align="right" height={28} wrapperStyle={{ paddingBottom: 8 }} />
                    <Bar dataKey="OK" name="Başarılı (OK)" fill="#0f9f6e" radius={[6, 6, 0, 0]} maxBarSize={42} />
                    <Bar dataKey="NOK" name="Hatalı (NOK)" fill="#d92d20" radius={[6, 6, 0, 0]} maxBarSize={42} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>
        </div>
      </div>

      <section className="mes-surface p-5">
        <CardHeader icon={ClipboardList} title="Açık İş Emirleri" subtitle="Yönetici özeti" />
        <div className="overflow-x-auto">
          <table className="modern-table">
            <thead>
              <tr>
                <th>İş Emri</th>
                <th>Ürün</th>
                <th>İstasyon</th>
                <th>Miktar</th>
                <th>Durum</th>
              </tr>
            </thead>
            <tbody>
              {workOrders.slice(0, 8).map((order) => (
                <tr key={order.id}>
                  <td><b>{order.orderNo}</b></td>
                  <td>{order.product}</td>
                  <td>{getStationDisplayName(order.station)}</td>
                  <td>{order.quantity}</td>
                  <td>{order.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default PlantOverviewPage;
