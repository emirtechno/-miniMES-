import { useMemo, useState } from 'react';
import {
  BarChart3,
  ClipboardList,
  Gauge,
  PauseCircle,
  PlayCircle,
  Wrench,
} from 'lucide-react';
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
import StationDetailPanel from '../components/StationDetailPanel';
import CardHeader from '../components/CardHeader';
import InfoTip from '../components/InfoTip';
import {
  ACTIVE_STATION_DEFINITIONS,
  getStationDisplayName,
  getStationMeta,
} from '../constants/stations';

const statusFromMetrics = ({ total, nok, ok }) => {
  if (total === 0) return { key: 'idle', label: 'Beklemede', pill: 'mes-pill-neutral', Icon: PauseCircle };
  if (nok > ok) return { key: 'stop', label: 'Durdu / Kalite Riski', pill: 'mes-pill-stop', Icon: PauseCircle };
  if (nok > 0 && nok / Math.max(total, 1) >= 0.15) {
    return { key: 'maint', label: 'Dikkat / Bakım Gerekebilir', pill: 'mes-pill-maint', Icon: Wrench };
  }
  return { key: 'run', label: 'Çalışıyor', pill: 'mes-pill-run', Icon: PlayCircle };
};

const StationsPage = ({
  stationChartData,
  stationDetailOptions,
  selectedStation,
  onStationChange,
  stationMetrics,
  recentRecords,
  stations,
  records,
  onSelectStation,
}) => {
  const [lineFilter, setLineFilter] = useState('Tümü');

  const catalogStations = useMemo(() => {
    const ids = new Set([
      ...ACTIVE_STATION_DEFINITIONS.map((s) => s.id),
      ...(stations || []),
    ]);
    return [...ids].map((id) => getStationMeta(id));
  }, [stations]);

  const lines = useMemo(
    () => ['Tümü', ...new Set(catalogStations.map((s) => s.line))],
    [catalogStations],
  );

  const visibleStations = catalogStations.filter(
    (station) => lineFilter === 'Tümü' || station.line === lineFilter,
  );

  const chartData = (stationChartData || []).map((row) => ({
    ...row,
    name: getStationDisplayName(row.name),
  }));

  return (
    <div className="flex flex-col gap-5">
      <section className="mes-surface p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="mes-section-title m-0 flex items-center gap-2">
              <Gauge size={20} className="text-[color:var(--color-vestel)]" />
              Fabrika İstasyonları
            </h2>
            <p className="mes-helper mt-1 mb-0 max-w-3xl">
              Her kart bir fiziksel istasyonu temsil eder. Durum; son üretim kayıtlarındaki OK/NOK dengesinden
              türetilir. Detay için kartı seçin.
              <InfoTip text="Çalışıyor = sağlıklı akış, Dikkat = yüksek NOK oranı, Durdu = NOK baskın veya kritik sapma." className="ml-1" />
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {lines.map((line) => (
              <button
                key={line}
                type="button"
                className={lineFilter === line ? 'mes-btn-primary' : 'mes-btn-secondary'}
                onClick={() => setLineFilter(line)}
              >
                {line}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visibleStations.map((station) => {
            const stationRecords = (records || []).filter((record) => record.istasyonAdi === station.id);
            const total = stationRecords.length;
            const ok = stationRecords.filter((record) => record.kaliteDurumu === 'OK').length;
            const nok = stationRecords.filter((record) => record.kaliteDurumu === 'NOK').length;
            const yieldRate = total > 0 ? ((ok / total) * 100).toFixed(1) : '0.0';
            const status = statusFromMetrics({ total, ok, nok });
            const StatusIcon = status.Icon;
            const isSelected = selectedStation === station.id;
            const latest = stationRecords[0];

            return (
              <article
                key={station.id}
                className={`rounded-xl border p-4 transition ${
                  isSelected
                    ? 'border-[color:var(--color-vestel)] bg-red-50/40 shadow-sm'
                    : 'border-[color:var(--color-line)] bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
                      {station.line} · {station.area}
                    </div>
                    <h3 className="mt-1 font-display text-xl font-semibold text-[color:var(--color-ink)]">
                      {station.displayName}
                    </h3>
                  </div>
                  <span className={status.pill}>
                    <StatusIcon size={13} />
                    {status.label}
                  </span>
                </div>

                <p className="mt-2 text-sm text-[color:var(--color-muted)]">{station.description}</p>

                <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-slate-50 px-2 py-2">
                    <dt className="text-[10px] uppercase tracking-wide text-[color:var(--color-muted)]">Toplam</dt>
                    <dd className="m-0 font-display text-lg font-semibold">{total}</dd>
                  </div>
                  <div className="rounded-lg bg-emerald-50/70 px-2 py-2">
                    <dt className="text-[10px] uppercase tracking-wide text-emerald-800">OK</dt>
                    <dd className="m-0 font-display text-lg font-semibold text-emerald-800">{ok}</dd>
                  </div>
                  <div className="rounded-lg bg-red-50/70 px-2 py-2">
                    <dt className="text-[10px] uppercase tracking-wide text-red-800">NOK</dt>
                    <dd className="m-0 font-display text-lg font-semibold text-red-800">{nok}</dd>
                  </div>
                </dl>

                <div className="mt-3 flex items-center justify-between gap-2 text-xs text-[color:var(--color-muted)]">
                  <span className="inline-flex items-center gap-1">
                    <ClipboardList size={13} />
                    Verimlilik %{yieldRate}
                  </span>
                  <span title={latest?.urun20liKod || ''}>
                    {latest ? `Son WO/ürün: ${String(latest.urun20liKod || '').slice(0, 10)}…` : 'Aktif iş emri yok'}
                  </span>
                </div>

                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    className="mes-btn-primary flex-1"
                    onClick={() => onSelectStation?.(station.id)}
                  >
                    Detayı Aç
                  </button>
                  <button
                    type="button"
                    className="mes-btn-secondary"
                    title="İstasyon kodu (API kimliği)"
                  >
                    {station.id.split('_').slice(-1)[0]}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mes-surface p-5">
        <CardHeader
          icon={BarChart3}
          title="İstasyon Bazlı Üretim Hacmi"
          subtitle="OK / NOK adetleri canlı üretim kayıtlarından hesaplanır"
        />
        <div className="h-[400px] w-full">
          {chartData.length === 0 ? (
            <p className="pt-24 text-center text-[color:var(--color-muted)]">Grafik verisi bulunamadı.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 28, right: 12, left: 0, bottom: 88 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="name"
                  interval={0}
                  angle={-32}
                  textAnchor="end"
                  height={78}
                  tick={{ fontSize: 10, fill: '#5b6b7c' }}
                  axisLine={false}
                  tickLine={false}
                  tickMargin={10}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#5b6b7c' }} axisLine={false} tickLine={false} width={36} />
                <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #d7dee8' }} />
                <Legend verticalAlign="top" align="right" height={28} wrapperStyle={{ paddingBottom: 8 }} />
                <Bar dataKey="OK" fill="#0f9f6e" name="Başarılı (OK)" radius={[8, 8, 0, 0]} maxBarSize={42} />
                <Bar dataKey="NOK" fill="#d92d20" name="Hatalı (NOK)" radius={[8, 8, 0, 0]} maxBarSize={42} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <StationDetailPanel
        stationsList={stationDetailOptions}
        selectedStation={selectedStation}
        onStationChange={onStationChange}
        stationMetrics={stationMetrics}
        recentRecords={recentRecords}
      />
    </div>
  );
};

export default StationsPage;
