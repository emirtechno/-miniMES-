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
import { fetchMachineMetrics, fetchShiftCurrentOee } from '../services/api';
import { useNonOverlappingPolling } from '../hooks/useNonOverlappingPolling';
import { useMesHub } from '../hooks/useMesHub';
import { DEFAULT_STATION, ACTIVE_STATION_DEFINITIONS, getStationDisplayName } from '../constants/stations';
import CardHeader from './CardHeader';
import { kpiFromShiftOee } from '../utils/telemetryAggregate';
import { OEE_METRIC_TIPS } from '../constants/oeeMetricTips';

const TREND_RANGES = [
  { id: '30s', label: '30s', ms: 30_000, limit: 40 },
  { id: '1m', label: '1m', ms: 60_000, limit: 60 },
  { id: '3m', label: '3m', ms: 180_000, limit: 80 },
  { id: '5m', label: '5m', ms: 300_000, limit: 100 },
  { id: '30m', label: '30m', ms: 1_800_000, limit: 160 },
  { id: '1h', label: '1h', ms: 3_600_000, limit: 200 },
  { id: '4h', label: '4h', ms: 14_400_000, limit: 200 },
  { id: '1d', label: '1 gün', ms: 86_400_000, limit: 200 },
];

const resolveInitialStation = (param) => {
  if (!param) return DEFAULT_STATION;
  if (param === 'Tümü') return 'Tümü';
  const match = ACTIVE_STATION_DEFINITIONS.find((s) => s.id === param);
  return match ? match.id : DEFAULT_STATION;
};

const formatTickTime = (ms, rangeMs) => {
  const date = new Date(ms);
  if (rangeMs <= 5 * 60_000) {
    return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  if (rangeMs <= 4 * 60 * 60_000) {
    return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const TrendTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div
      className="rounded-lg border border-[color:var(--color-line)] bg-white px-3 py-2 text-xs shadow-md"
      style={{ minWidth: 180 }}
    >
      <div className="mb-1 font-semibold text-[color:var(--color-ink)]">{row.timeLabel}</div>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex justify-between gap-4" style={{ color: entry.color }}>
          <span>{entry.name}</span>
          <span className="font-semibold">{entry.value}</span>
        </div>
      ))}
      <div className="mt-1 border-t border-slate-100 pt-1 text-[10px] text-slate-500">
        Bu tick: {row.tickActual}/{row.tickGood} · duruş {row.tickDown} sn
      </div>
    </div>
  );
};

const metricsFingerprint = (items) => {
  if (!items?.length) return '0';
  const first = items[0];
  const last = items[items.length - 1];
  return `${items.length}:${first?.id ?? ''}:${last?.id ?? ''}:${first?.recordedAt ?? ''}:${last?.recordedAt ?? ''}`;
};

const applyMetricsIfChanged = (setter, nextItems) => {
  setter((prev) => (metricsFingerprint(prev) === metricsFingerprint(nextItems) ? prev : nextItems));
};

// NEDEN: Makine metrik paneli kendi poll'unu SSOT kabul eder — App-level metricsFeed buraya merge edilmez
// (önceden last-120 üzerine yazınca Σ yükseklik kısa→uzun→kısa zıplıyordu).
// NASIL: Aralık + istasyon ile MachineMetrics çek → kümülatif chartData; OEE = /Oee/shift-current (katalog vardiya).
const MachineMetricsPanel = ({
  isFactorySimulationActive = false,
  shiftStationId,
  shiftActive = false,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const stationFromUrl = searchParams.get('stationId');
  const [selectedStation, setSelectedStation] = useState(() => resolveInitialStation(stationFromUrl));
  const [rangeId, setRangeId] = useState('5m');
  const [metrics, setMetrics] = useState([]);
  const [oeeData, setOeeData] = useState(null);
  const [loading, setLoading] = useState(true);

  const selectedRange = TREND_RANGES.find((range) => range.id === rangeId) || TREND_RANGES[3];

  useEffect(() => {
    const next = resolveInitialStation(stationFromUrl);
    setSelectedStation((current) => (current === next ? current : next));
  }, [stationFromUrl]);

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

  const loadShiftOee = useCallback(async (signal) => {
    if (!selectedStation || selectedStation === 'Tümü') {
      setOeeData(null);
      return;
    }
    try {
      setOeeData(await fetchShiftCurrentOee(selectedStation, { signal }));
    } catch (error) {
      if (error.response?.status === 404) setOeeData(null);
      else throw error;
    }
  }, [selectedStation]);

  useMesHub({
    onOeeUpdated: () => {
      loadShiftOee(undefined).catch(() => {});
    },
  });

  useNonOverlappingPolling(async (signal) => {
    try {
      const from = new Date(Date.now() - selectedRange.ms).toISOString();
      const page = await fetchMachineMetrics({
        signal,
        stationId: selectedStation === 'Tümü' ? undefined : selectedStation,
        from,
        limit: selectedRange.limit,
      });
      applyMetricsIfChanged(setMetrics, page.items);

      await loadShiftOee(signal);
    } finally {
      setLoading(false);
    }
  }, {
    enabled: true,
    intervalMs: isFactorySimulationActive ? 8000 : 20000,
    resetKey: `${selectedStation}:${isFactorySimulationActive}:${rangeId}`,
  });

  const stationsList = useMemo(
    () => ['Tümü', ...ACTIVE_STATION_DEFINITIONS.map((s) => s.id)],
    [],
  );

  // NEDEN: Panel poll grafik/tablo için tek kaynak. App-level plant feed (son 120) buraya merge edilmez —
  // o overwrite Σ yüksekliğini kısa→uzun→kısa zıplatıyordu.
  // NASIL: Ham tick'ler zaman sırasıyla; Gerceklesen/Saglam/Durus kümülatif; tick* alanları tooltip için.
  const chartData = useMemo(() => {
    const sorted = [...metrics]
      .filter((item) => item.recordedAt)
      .sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));

    return sorted.reduce((rows, item, index) => {
      const ms = new Date(item.recordedAt).getTime();
      const prev = rows[rows.length - 1];
      const cumActual = (prev?.Gerceklesen ?? 0) + (Number(item.actualProductionCount) || 0);
      const cumGood = (prev?.Saglam ?? 0) + (Number(item.goodProductionCount) || 0);
      const cumDown = (prev?.Durus ?? 0) + (Number(item.downtimeSeconds) || 0);
      rows.push({
        t: ms,
        timeLabel: formatTickTime(ms, selectedRange.ms),
        Gerceklesen: cumActual,
        Saglam: cumGood,
        Durus: cumDown,
        tickActual: item.actualProductionCount ?? 0,
        tickGood: item.goodProductionCount ?? 0,
        tickDown: item.downtimeSeconds ?? 0,
        id: item.id ?? `${ms}-${index}`,
      });
      return rows;
    }, []);
  }, [metrics, selectedRange]);

  const chartDomain = useMemo(() => {
    if (!chartData.length) return ['dataMin', 'dataMax'];
    const newest = chartData[chartData.length - 1].t;
    const oldest = chartData[0].t;
    const span = newest - oldest;
    // NEDEN: API limit yüzünden tick'ler seçilen pencerenin yarısından azını kapsıyorsa ekseni veriye zoom'la —
    // 24s boş eksen + sağda sivri uç olmasın.
    if (span < selectedRange.ms * 0.5) {
      return [oldest, newest];
    }
    return [newest - selectedRange.ms, newest];
  }, [chartData, selectedRange.ms]);

  const stationLabel = selectedStation === 'Tümü' ? 'Tüm İstasyonlar' : getStationDisplayName(selectedStation);

  const okNok = useMemo(
    () => kpiFromShiftOee(oeeData, selectedStation === 'Tümü' ? null : selectedStation),
    [oeeData, selectedStation],
  );

  const latestMetric = metrics[0];
  const temperature = latestMetric?.temperature;
  const rpm = latestMetric?.rpm;
  const vibration = latestMetric?.vibration;
  const formatGauge = (value, digits = 0) => (
    value == null || Number.isNaN(Number(value)) ? '—' : Number(value).toFixed(digits)
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
              Makine telemetri &amp; fabrika simülasyonu
            </p>
            <h2 className="font-display m-0 mt-1 text-2xl font-semibold text-[color:var(--color-ink)]">
              {stationLabel}
            </h2>
            <p className="mes-helper mt-2 mb-0 max-w-2xl">
              Üst KPI / OEE = <strong>katalog vardiya</strong> (<code>/Oee/shift-current</code>, Andon ile aynı; oturum başlatınca sıfırlanmaz).
              Temp/RPM/Titreşim = son tick; tablo = ham MachineMetrics. Operatör oturum KPI’sı Operatör Panelindedir.
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
              ? `Fabrika telemetrisi aktif${shiftStationId ? ` · istasyon ${getStationDisplayName(shiftStationId)}` : ''} — MachineMetrics SSOT.`
              : shiftActive
                ? 'Vardiya aktif ancak duruş/setup’ta — operatör oturumu duraklatıldı.'
                : 'Vardiya kapalı — Operatör Panelinden Vardiya Başlat ile oturum açın. Backend telemetrisi bağımsız çalışabilir.'}
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          {[
            { label: 'Anlık Sıcaklık', value: `${formatGauge(temperature, 1)}°C`, icon: Thermometer, tone: Number(temperature) >= 85 ? 'text-red-700' : 'text-amber-700' },
            { label: 'Anlık RPM', value: formatGauge(rpm, 0), icon: Gauge, tone: Number(rpm) > 0 && Number(rpm) < 500 ? 'text-red-700' : 'text-sky-700' },
            { label: 'Anlık Titreşim', value: `${formatGauge(vibration, 2)} mm/s`, icon: Waves, tone: Number(vibration) >= 2.8 ? 'text-red-700' : 'text-slate-800' },
            { label: 'Katalog Σ OK', value: selectedStation === 'Tümü' ? '—' : okNok.good, icon: Activity, tone: 'text-emerald-700' },
            { label: 'Katalog Σ NOK', value: selectedStation === 'Tümü' ? '—' : okNok.nok, icon: Activity, tone: 'text-red-700' },
            { label: 'Katalog Σ Actual', value: selectedStation === 'Tümü' ? '—' : okNok.actual, icon: Cpu, tone: 'text-[color:var(--color-ink)]' },
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
            { label: 'Katalog OEE', value: `%${oeeData.oee}`, tone: 'text-sky-700', tip: `${OEE_METRIC_TIPS.oee} ${OEE_METRIC_TIPS.catalogOee}` },
            { label: 'Kullanılabilirlik', value: `%${oeeData.availability}`, tone: 'text-emerald-700', tip: OEE_METRIC_TIPS.availability },
            { label: 'Performans', value: `%${oeeData.performance}`, tone: 'text-amber-700', tip: OEE_METRIC_TIPS.performance },
            { label: 'Kalite', value: `%${oeeData.quality}`, tone: 'text-rose-700', tip: OEE_METRIC_TIPS.quality },
            { label: 'Katalog pencere', value: oeeData.shiftName || oeeData.shiftCode || '—', tone: 'text-slate-800', tip: OEE_METRIC_TIPS.catalogOee },
          ].map((card) => (
            <div key={card.label} className="mes-surface p-4" title={card.tip} style={{ cursor: 'help' }}>
              <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">{card.label}</div>
              <div className={`font-display mt-1 text-2xl font-semibold ${card.tone}`}>{card.value}</div>
            </div>
          ))}
        </section>
      )}

      <section className="mes-surface p-5">
        <CardHeader
          icon={Cpu}
          title="Zaman Bazlı Üretim ve Duruş Trendi"
          subtitle={`Kümülatif üretim: ${stationLabel} — ${selectedRange.label} (yüklenen tick’ler; tablo ham kayıt)`}
          actions={renderStationSelect()}
        />
        <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Trend zaman aralığı">
          {TREND_RANGES.map((range) => (
            <button
              key={range.id}
              type="button"
              className={rangeId === range.id ? 'mes-btn-primary' : 'mes-btn-secondary'}
              onClick={() => setRangeId(range.id)}
            >
              {range.label}
            </button>
          ))}
        </div>
        <div className="h-[320px] w-full">
          {chartData.length === 0 ? (
            <p className="pt-24 text-center text-[color:var(--color-muted)]">
              {loading ? 'Trend verisi yükleniyor...' : 'Seçili istasyon / zaman aralığı için trend verisi yok.'}
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
                <XAxis
                  dataKey="t"
                  type="number"
                  domain={chartDomain}
                  allowDataOverflow
                  tickFormatter={(value) => formatTickTime(value, selectedRange.ms)}
                  tick={{ fill: '#5b6b7c', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={28}
                />
                <YAxis tick={{ fill: '#5b6b7c', fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
                <Tooltip
                  content={<TrendTooltip />}
                  cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '4 4' }}
                  isAnimationActive={false}
                />
                <Legend />
                <Area
                  type="linear"
                  dataKey="Gerceklesen"
                  name="Σ Gerçekleşen"
                  stroke="#1769aa"
                  fill="url(#gradActual)"
                  strokeWidth={2.2}
                  isAnimationActive={false}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Area
                  type="linear"
                  dataKey="Saglam"
                  name="Σ Sağlam (OK)"
                  stroke="#0f9f6e"
                  fill="url(#gradGood)"
                  strokeWidth={2.2}
                  isAnimationActive={false}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Area
                  type="linear"
                  dataKey="Durus"
                  name="Σ Duruş (sn)"
                  stroke="#d92d20"
                  fill="url(#gradDown)"
                  strokeWidth={2}
                  isAnimationActive={false}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section className="mes-surface p-5">
        <CardHeader
          icon={Cpu}
          title="Tick kayıtları"
          subtitle="Ham MachineMetrics satırları (SCADA / PLC / sim — değiştirilemez)"
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
