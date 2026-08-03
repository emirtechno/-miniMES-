import { Activity } from 'lucide-react';
import RecentRecordsList from './RecentRecordsList';
import InfoTip from './InfoTip';
import { getStationDisplayName } from '../constants/stations';

const StationDetailPanel = ({ stationsList, selectedStation, onStationChange, stationMetrics, recentRecords }) => (
  <section className="mes-surface p-5">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Activity size={20} className="text-[color:var(--color-vestel)]" />
        <div>
          <h2 className="mes-section-title m-0">İstasyon Detayı</h2>
          <p className="mes-helper mt-0.5 mb-0">
            Seçili istasyonun anlık kalite özeti ve son üretim kayıtları
            <InfoTip text="Veriler canlı üretim API kayıtlarından gelir; ham ID yerine ürün/malzeme kodları ve zaman damgası gösterilir." className="ml-1 align-middle" />
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
        { label: 'Toplam İşlenen', value: stationMetrics.total, hint: 'Bu istasyona ait üretim kaydı sayısı' },
        { label: 'Başarılı (OK)', value: stationMetrics.ok, tone: 'text-emerald-700', hint: 'Kalite OK kayıtları' },
        { label: 'Hatalı (NOK)', value: stationMetrics.nok, tone: 'text-red-700', hint: 'Kalite NOK kayıtları' },
        { label: 'Verimlilik', value: `%${stationMetrics.yield}`, tone: 'text-amber-700', hint: 'OK / toplam oranı' },
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
        <h3 className="m-0 text-sm font-semibold text-[color:var(--color-ink)]">Son kayıtlar</h3>
        <span className="text-xs text-[color:var(--color-muted)]">En fazla 6 kayıt</span>
      </div>
      <RecentRecordsList
        records={recentRecords}
        emptyText="Bu istasyon için henüz üretim kaydı yok. Üretim Panelinden yeni kayıt ekleyebilirsiniz."
      />
    </div>
  </section>
);

export default StationDetailPanel;
