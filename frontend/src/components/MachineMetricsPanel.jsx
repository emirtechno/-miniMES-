import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Activity,
  Cpu,
  Thermometer,
  Gauge,
  Waves,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { fetchLatestOee, fetchMachineMetrics } from '../services/api';
import { useNonOverlappingPolling } from '../hooks/useNonOverlappingPolling';
import { useMesHub } from '../hooks/useMesHub';
import { DEFAULT_STATION, ACTIVE_STATION_DEFINITIONS, getStationDisplayName } from '../constants/stations';
import { deriveLiveTelemetry } from '../utils/liveTelemetry';
import CardHeader from './CardHeader';
import TraceabilityPanel from './TraceabilityPanel';

const resolveInitialStation = (param) => {
  if (!param) return DEFAULT_STATION;
  if (param === 'Tümü') return 'Tümü';
  const match = ACTIVE_STATION_DEFINITIONS.find((s) => s.id === param);
  return match ? match.id : DEFAULT_STATION;
};

const MachineMetricsPanel = ({
  isFactorySimulationActive = false,
  shiftStationId,
  shiftActive = false,
  stationKpi,
  batches = [],
  metricsFeed = [],
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const stationFromUrl = searchParams.get('stationId');
  const [selectedStation, setSelectedStation] = useState(() => resolveInitialStation(stationFromUrl));
  const [metrics, setMetrics] = useState([]);
  const [oeeData, setOeeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    const next = resolveInitialStation(stationFromUrl);
    setSelectedStation((current) => (current === next ? current : next));
  }, [stationFromUrl]);

  useEffect(() => {
    if (!isFactorySimulationActive) return undefined;
    const id = window.setInterval(() => setPulse(Date.now()), 900);
    return () => window.clearInterval(id);
  }, [isFactorySimulationActive]);

  const selectStation = useCallback((stationId) => {
    setSelectedStation(stationId);
    const next = new URLSearchParams(searchParams);
    if (!stationId || stationId === 'Tümü') {
      next.delete('stationId');
    } else {
      next.set('stationId', stationId);
    }
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleOeeUpdated = useCallback((payload) => {
    const latest = (payload || []).find((item) => item.stationId === selectedStation);
    if (latest) setOeeData(latest);
  }, [selectedStation]);

  useMesHub({ onOeeUpdated: handleOeeUpdated });

  useNonOverlappingPolling(async (signal) => {
    try {
      const page = await fetchMachineMetrics({
        signal,
        stationId: selectedStation === 'Tümü' ? undefined : selectedStation,
        limit: 80,
      });
      setMetrics(page.items);

      if (selectedStation && selectedStation !== 'Tümü') {
        try {
          setOeeData(await fetchLatestOee(selectedStation, { signal }));
        } catch (error) {
          if (error.response?.status === 404) setOeeData(null);
          else throw error;
        }
      } else {
        setOeeData(null);
      }
    } finally {
      setLoading(false);
    }
  }, {
    enabled: true,
    intervalMs: isFactorySimulationActive ? 8000 : 20000,
    resetKey: `${selectedStation}:${isFactorySimulationActive}`,
  });

  const stationsList = useMemo(
    () => ['Tümü', ...ACTIVE_STATION_DEFINITIONS.map((s) => s.id)],
    [],
  );

  const chartData = useMemo(() => [...metrics]
    .slice()
    .sort((a, b) => new Date(a.recordedAt || 0) - new Date(b.recordedAt || 0))
    .map((item) => ({
      time: item.recordedAt ? new Date(item.recordedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '',
      Gerceklesen: item.actualProductionCount,
      Saglam: item.goodProductionCount,
      Durus: item.downtimeSeconds,
    })), [metrics]);

  const stationLabel = selectedStation === 'Tümü' ? 'Tüm İstasyonlar' : getStationDisplayName(selectedStation);

  const okNok = useMemo(() => {
    const kpi = typeof stationKpi === 'function'
      ? stationKpi(selectedStation === 'Tümü' ? null : selectedStation)
      : { good: 0, nok: 0, actual: 0 };
    return { ok: kpi.good || 0, nok: kpi.nok || 0, total: kpi.actual || 0 };
  }, [stationKpi, selectedStation]);

  const filteredBatches = useMemo(() => {
    if (selectedStation === 'Tümü') return batches;
    return batches.filter((batch) => batch.station === selectedStation);
  }, [batches, selectedStation]);

  // Prefer shared feed when Live Stream is pushing; otherwise poll locally.
  useEffect(() => {
    if (!metricsFeed?.length) return;
    if (selectedStation === 'Tümü') {
      setMetrics(metricsFeed.slice(0, 80));
      return;
    }
    setMetrics(metricsFeed.filter((item) => item.stationId === selectedStation).slice(0, 80));
  }, [metricsFeed, selectedStation]);

  const latestMetric = metrics[0];
  const telemetry = useMemo(
    () => deriveLiveTelemetry(latestMetric, pulse, isFactorySimulationActive),
    [latestMetric, pulse, isFactorySimulationActive],
  );

  const renderStationSelect = () => (
    <select
      className="mes-input h-10 w-auto min-w-[200px]"
      value={selectedStation}
      onChange={(event) => selectStation(event.target.value)}
      aria-label="Trend istasyon seçimi"
    >
      {stationsList.map((station) => (
        <option key={station} value={station}>
          {station === 'Tümü' ? 'Tüm İstasyonlar' : getStationDisplayName(station)}
        </option>
      ))}
    </select>
  );

  return (
    <div className="flex flex-col gap-5">
      <section className="mes-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)]">
              Makine telemetri & Live Stream
            </p>
            <h2 className="font-display m-0 mt-1 text-2xl font-semibold text-[color:var(--color-ink)]">
              {stationLabel}
            </h2>
            <p className="mes-helper mt-2 mb-0 max-w-2xl">
              Tek kaynak: MachineMetrics. Live Stream her tick’te Gerçekleşen/Sağlam/Duruş batch yazar;
              KPI’lar Σ Actual / Σ Good / Σ (Actual−Good) ile hesaplanır. Barkod 1-by-1 sayım yoktur.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {renderStationSelect()}
            {!shiftActive && (
              <Link to="/operator" className="mes-btn-primary">
                Vardiya Başlat
              </Link>
            )}
          </div>
        </div>

        <div
          className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
            isFactorySimulationActive
              ? 'border-emerald-200 bg-emerald-50/80 text-emerald-950'
              : 'border-[color:var(--color-line)] bg-slate-50 text-[color:var(--color-muted)]'
          }`}
        >
          <span className="inline-flex items-center gap-2 font-semibold">
            <Activity size={16} className={isFactorySimulationActive ? 'animate-pulse' : ''} />
            {isFactorySimulationActive
              ? `Live Stream açık${shiftStationId ? ` · istasyon ${getStationDisplayName(shiftStationId)}` : ''} — telemetri ve lot ilerlemesi güncelleniyor.`
              : shiftActive
                ? 'Vardiya aktif ancak duruş/setup’ta — Live Stream duraklatıldı. Üretime dönünce akış devam eder.'
                : 'Live Stream kapalı — Operatör Panelinden Vardiya Başlat ile telemetri motorunu açın.'}
          </span>
          <p className="mt-2 mb-0 text-xs opacity-80">
            * Sıcaklık / RPM / Titreşim alanları PLC kolonundan gelmez; MachineMetrics (duruş, Actual/Good, çevrim)
            değerlerinden türetilmiş canlı göstergelerdir. Anomali eşikleri Andon alarmı üretebilir.
          </p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          {[
            { label: 'Sıcaklık*', value: `${telemetry.temperature}°C`, icon: Thermometer, tone: telemetry.temperature > 70 ? 'text-red-700' : 'text-amber-700' },
            { label: 'RPM*', value: telemetry.rpm, icon: Gauge, tone: 'text-sky-700' },
            { label: 'Titreşim*', value: `${telemetry.vibration} mm/s`, icon: Waves, tone: telemetry.vibration > 2.5 ? 'text-red-700' : 'text-slate-800' },
            { label: 'Σ OK', value: okNok.ok, icon: Activity, tone: 'text-emerald-700' },
            { label: 'Σ NOK', value: okNok.nok, icon: Activity, tone: 'text-red-700' },
            { label: 'Σ Actual', value: okNok.total, icon: Cpu, tone: 'text-[color:var(--color-ink)]' },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="rounded-xl border border-[color:var(--color-line)] bg-white px-4 py-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
                  <Icon size={13} />
                  {card.label}
                </div>
                <div className={`font-display mt-1 text-2xl font-semibold ${card.tone}`}>{card.value}</div>
              </div>
            );
          })}
        </div>
      </section>

      {oeeData && selectedStation !== 'Tümü' && (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            { label: 'Genel OEE', value: `%${oeeData.oee}`, tone: 'text-sky-700' },
            { label: 'Kullanılabilirlik', value: `%${oeeData.availability}`, tone: 'text-emerald-700' },
            { label: 'Performans', value: `%${oeeData.performance}`, tone: 'text-amber-700' },
            { label: 'Kalite', value: `%${oeeData.quality}`, tone: 'text-rose-700' },
            { label: 'Vardiya', value: oeeData.shiftName || oeeData.shiftCode || '—', tone: 'text-slate-800' },
          ].map((card) => (
            <div key={card.label} className="mes-surface p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">{card.label}</div>
              <div className={`font-display mt-1 text-2xl font-semibold ${card.tone}`}>{card.value}</div>
            </div>
          ))}
        </section>
      )}

      <TraceabilityPanel batches={filteredBatches} />

      <section className="mes-surface p-5">
        <CardHeader
          icon={Cpu}
          title="Zaman Bazlı Üretim ve Duruş Trendi"
          subtitle={`Aktif seçim: ${stationLabel} — grafik yalnızca bu istasyonun telemetrisini gösterir`}
          actions={renderStationSelect()}
        />
        <div className="h-[320px] w-full">
          {chartData.length === 0 ? (
            <p className="pt-24 text-center text-[color:var(--color-muted)]">
              {loading ? 'Trend verisi yükleniyor...' : 'Seçili istasyon için trend verisi yok.'}
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradActual" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1769aa" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#1769aa" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gradGood" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0f9f6e" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#0f9f6e" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gradDown" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#d92d20" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#d92d20" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="time" tick={{ fill: '#5b6b7c', fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={28} />
                <YAxis tick={{ fill: '#5b6b7c', fontSize: 11 }} axisLine={false} tickLine={false} width={42} />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: '1px solid #d7dee8', boxShadow: '0 8px 24px rgba(15,23,42,0.08)' }}
                />
                <Legend />
                <Area type="monotone" dataKey="Gerceklesen" name="Gerçekleşen" stroke="#1769aa" fill="url(#gradActual)" strokeWidth={2.2} />
                <Area type="monotone" dataKey="Saglam" name="Sağlam (OK)" stroke="#0f9f6e" fill="url(#gradGood)" strokeWidth={2.2} />
                <Area type="monotone" dataKey="Durus" name="Duruş (sn)" stroke="#d92d20" fill="url(#gradDown)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section className="mes-surface p-5">
        <CardHeader
          icon={Cpu}
          title="Makine Telemetri Kayıtları"
          subtitle="SCADA / PLC / Live Stream satırları (değiştirilemez)"
          actions={renderStationSelect()}
        />
        <div className="overflow-x-auto">
          {metrics.length === 0 ? (
            <p className="py-8 text-center text-[color:var(--color-muted)]">
              {loading ? 'Veriler yükleniyor...' : 'Bu istasyon için henüz makine metrik verisi bulunmuyor.'}
            </p>
          ) : (
            <table className="modern-table">
              <thead>
                <tr>
                  <th>İstasyon</th>
                  <th>Vardiya</th>
                  <th>Planlanan Süre</th>
                  <th>Duruş (sn)</th>
                  <th>Duruş Nedeni</th>
                  <th>İdeal Çevrim</th>
                  <th>Gerçekleşen</th>
                  <th>Sağlam (OK)</th>
                  <th>Kayıt Zamanı</th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((item, index) => (
                  <tr key={`${item.stationId}-${item.recordedAt}-${index}`}>
                    <td><b>{getStationDisplayName(item.stationId)}</b></td>
                    <td>{item.shiftName || item.shiftCode || '—'}</td>
                    <td>{item.plannedProductionSeconds} sn</td>
                    <td style={{ color: item.downtimeSeconds > 30 ? '#d92d20' : 'inherit', fontWeight: item.downtimeSeconds > 30 ? 700 : 400 }}>
                      {item.downtimeSeconds} sn
                    </td>
                    <td>{item.downtimeReason || item.downtimeReasonCode || '—'}</td>
                    <td>{item.idealCycleTimeSeconds} sn</td>
                    <td><b>{item.actualProductionCount}</b></td>
                    <td style={{ color: '#0f9f6e', fontWeight: 700 }}>{item.goodProductionCount}</td>
                    <td style={{ color: '#5b6b7c' }}>{item.recordedAt ? new Date(item.recordedAt).toLocaleTimeString('tr-TR') : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
};

export default MachineMetricsPanel;
