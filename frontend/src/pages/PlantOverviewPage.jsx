import { useEffect, useMemo, useState } from 'react';
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
import { fetchLatestOee } from '../services/api';
import { ACTIVE_STATION_DEFINITIONS, DEFAULT_STATION, getStationDisplayName } from '../constants/stations';

const toneForOee = (value) => {
  if (value == null) return 'idle';
  if (value >= 85) return 'good';
  if (value >= 60) return 'warn';
  return 'bad';
};

/**
 * Plant manager command center: factory-wide OEE and multi-line status timeline.
 */
const PlantOverviewPage = ({ stationChartData = [], records = [], workOrders = [] }) => {
  const [oeeByStation, setOeeByStation] = useState({});
  const [focusStation, setFocusStation] = useState(DEFAULT_STATION);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all(
      ACTIVE_STATION_DEFINITIONS.map(async (station) => {
        try {
          const metric = await fetchLatestOee(station.id, { signal: controller.signal });
          return [station.id, metric];
        } catch {
          return [station.id, null];
        }
      }),
    ).then((entries) => setOeeByStation(Object.fromEntries(entries)));
    return () => controller.abort();
  }, []);

  const plantAverage = useMemo(() => {
    const values = Object.values(oeeByStation)
      .map((item) => item?.oee)
      .filter((value) => typeof value === 'number');
    if (!values.length) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }, [oeeByStation]);

  const volumeData = useMemo(
    () => (stationChartData || []).map((row) => ({
      ...row,
      name: getStationDisplayName(row.name),
    })),
    [stationChartData],
  );

  const activeWo = workOrders.filter((order) => order.status !== 'Tamamlandı').length;
  const totalOk = records.filter((r) => r.kaliteDurumu === 'OK').length;
  const totalNok = records.filter((r) => r.kaliteDurumu === 'NOK').length;

  return (
    <div className="flex flex-col gap-5">
      <section className="mes-surface p-5">
        <CardHeader
          icon={Factory}
          title="Fabrika Genel Bakış · Ana Merkez"
          subtitle="Plant manager görünümü — hatlar arası OEE, durum şeridi ve hacim"
          actions={(
            <select className="mes-input h-10 w-auto min-w-[200px]" value={focusStation} onChange={(e) => setFocusStation(e.target.value)}>
              {ACTIVE_STATION_DEFINITIONS.map((station) => (
                <option key={station.id} value={station.id}>{station.displayName}</option>
              ))}
            </select>
          )}
        />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-sky-800">Ortalama OEE</div>
            <div className="font-display mt-1 text-3xl font-semibold text-sky-950">
              {plantAverage == null ? '—' : `%${plantAverage.toFixed(1)}`}
            </div>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-emerald-800">OK Üretim</div>
            <div className="font-display mt-1 text-3xl font-semibold text-emerald-950">{totalOk}</div>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50/70 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-red-800">NOK</div>
            <div className="font-display mt-1 text-3xl font-semibold text-red-950">{totalNok}</div>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-amber-900">Açık İş Emri</div>
            <div className="font-display mt-1 text-3xl font-semibold text-amber-950">{activeWo}</div>
          </div>
        </div>
      </section>

      <section className="mes-surface p-5">
        <CardHeader icon={Activity} title="Hat Durum Şeridi" subtitle="Idle / Production / Setup / Standstill benzeri özet (OEE + kalite sinyali)" />
        <div className="grid gap-3">
          {ACTIVE_STATION_DEFINITIONS.map((station) => {
            const metric = oeeByStation[station.id];
            const oee = metric?.oee;
            const tone = toneForOee(oee);
            const stationRecords = records.filter((r) => r.istasyonAdi === station.id);
            const nokRatio = stationRecords.length
              ? stationRecords.filter((r) => r.kaliteDurumu === 'NOK').length / stationRecords.length
              : 0;
            const segments = [
              { key: 'prod', label: 'Production', flex: tone === 'good' ? 5 : tone === 'warn' ? 3 : 2, color: '#0f9f6e' },
              { key: 'setup', label: 'Setup', flex: metric?.isPlannedDowntime ? 2 : 1, color: '#c47f17' },
              { key: 'stand', label: 'Standstill', flex: tone === 'bad' || nokRatio > 0.2 ? 2 : 0.6, color: '#d92d20' },
              { key: 'idle', label: 'Idle', flex: oee == null ? 4 : 1, color: '#94a3b8' },
            ];
            return (
              <div key={station.id} className="rounded-xl border border-[color:var(--color-line)] p-3">
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
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <OeePanel stationId={focusStation} />
        <section className="mes-surface p-5">
          <CardHeader icon={Gauge} title="İstasyon Bazlı Üretim Hacmi" subtitle="OK / NOK karşılaştırması" />
          <div className="h-[300px]">
            {volumeData.length === 0 ? (
              <p className="pt-20 text-center text-[color:var(--color-muted)]">Hacim verisi yok.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={volumeData} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" interval={0} angle={-25} textAnchor="end" tick={{ fontSize: 11, fill: '#5b6b7c' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#5b6b7c' }} width={36} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="OK" name="Başarılı (OK)" fill="#0f9f6e" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="NOK" name="Hatalı (NOK)" fill="#d92d20" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
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
