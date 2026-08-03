import { useCallback, useMemo, useState } from 'react';
import { Cpu } from 'lucide-react';
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
import CardHeader from './CardHeader';

const MachineMetricsPanel = () => {
  const [metrics, setMetrics] = useState([]);
  const [selectedStation, setSelectedStation] = useState(DEFAULT_STATION);
  const [oeeData, setOeeData] = useState(null);
  const [loading, setLoading] = useState(true);

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
    intervalMs: 20000,
    resetKey: selectedStation,
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

  const renderStationSelect = () => (
    <select
      className="mes-input h-10 w-auto min-w-[200px]"
      value={selectedStation}
      onChange={(event) => setSelectedStation(event.target.value)}
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
          subtitle="SCADA / PLC / simülasyon satırları"
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
