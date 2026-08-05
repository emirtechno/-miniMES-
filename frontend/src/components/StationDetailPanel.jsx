import { Activity } from 'lucide-react';
import InfoTip from './InfoTip';
import { getStationDisplayName } from '../constants/stations';

const StationDetailPanel = ({
  stationsList,
  selectedStation,
  onStationChange,
  stationMetrics,
  recentTicks = [],
  className = '',
}) => (
  <section
    id="station-detail-panel"
    data-scroll-target="station-detail"
    className={`mes-surface relative z-0 p-5 transition ${className}`.trim()}
  >
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Activity size={20} className="text-[color:var(--color-vestel)]" />
        <div>
          <h2 className="mes-section-title m-0">İstasyon Detayı</h2>
          <p className="mes-helper mt-0.5 mb-0">
            Katalog vardiya toplamları (Andon ile aynı) ve son telemetri tick’leri
            <InfoTip text="Σ değerler /Oee/shift-current penceresidir; operatör oturumu sıfırlanınca burası sıfırlanmaz." className="ml-1 align-middle" />
          </p>
        </div>
      </div>

      <select className="mes-input max-w-xs" value={selectedStation} onChange={onStationChange}>
        {stationsList.map((station) => (
          <option key={station} value={station}>
            {getStationDisplayName(station)}
          </option>
        ))}
      </select>
    </div>

    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[
        { label: 'Katalog Σ Gerçekleşen', value: stationMetrics.total, hint: 'Aktif katalog vardiya penceresi Σ Actual' },
        { label: 'Katalog Σ Sağlam', value: stationMetrics.ok, tone: 'text-emerald-700', hint: 'Aktif katalog vardiya penceresi Σ Good' },
        { label: 'Katalog Σ Fire', value: stationMetrics.nok, tone: 'text-red-700', hint: 'Actual − Good (katalog pencere)' },
        { label: 'Katalog Verim', value: `%${stationMetrics.yield}`, tone: 'text-amber-700', hint: 'Good / Actual (katalog pencere)' },
      ].map((item) => (
        <div key={item.label} className="rounded-xl border border-[color:var(--color-line)] bg-slate-50/80 px-4 py-3">
          <div className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
            {item.label}
            <InfoTip text={item.hint} />
          </div>
          <div className={`mt-1 font-display text-2xl font-semibold ${item.tone || 'text-[color:var(--color-ink)]'}`}>
            {item.value}
          </div>
        </div>
      ))}
    </div>

    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="m-0 text-sm font-semibold text-[color:var(--color-ink)]">Son telemetri tick’leri</h3>
        <span className="text-xs text-[color:var(--color-muted)]">En fazla 6</span>
      </div>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {recentTicks.map((tick) => {
          const scrap = Math.max(0, (tick.actualProductionCount || 0) - (tick.goodProductionCount || 0));
          return (
            <li key={`${tick.id}-${tick.recordedAt}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[color:var(--color-line)] px-3 py-2 text-sm">
              <span className="font-medium">
                Gerçekleşen {tick.actualProductionCount} · Sağlam {tick.goodProductionCount}
                {scrap > 0 ? ` · Fire ${scrap}` : ''}
              </span>
              <span className="text-xs text-[color:var(--color-muted)]">
                {tick.recordedAt ? new Date(tick.recordedAt).toLocaleTimeString('tr-TR') : '—'}
              </span>
            </li>
          );
        })}
        {recentTicks.length === 0 && (
          <li className="text-sm text-[color:var(--color-muted)]">
            Henüz telemetri yok. Backend Fabrika Telemetrisi MachineMetrics’e yazdığında burada görünür.
          </li>
        )}
      </ul>
    </div>
  </section>
);

export default StationDetailPanel;
