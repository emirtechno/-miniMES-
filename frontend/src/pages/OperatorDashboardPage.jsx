import { useMemo, useState } from 'react';
import { ClipboardList, History, Package } from 'lucide-react';
import OperatorShiftWidget from '../components/OperatorShiftWidget';
import ProductionForm from '../components/ProductionForm';
import CardHeader from '../components/CardHeader';
import { ACTIVE_STATION_DEFINITIONS, DEFAULT_STATION, getStationDisplayName } from '../constants/stations';

/**
 * Operator-focused workspace: assigned station, active WO, counters, shift actions.
 */
const OperatorDashboardPage = ({
  currentUser,
  notify,
  canCreateAlarms,
  form,
  records = [],
  workOrders = [],
  canSubmit = true,
}) => {
  const [stationId, setStationId] = useState(form?.istasyonAdi || DEFAULT_STATION);

  const handleStationChange = (nextStationId) => {
    setStationId(nextStationId);
    form?.onChangeStation?.({ target: { value: nextStationId } });
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

  return (
    <div className="flex flex-col gap-5">
      <section className="mes-surface p-5">
        <CardHeader
          icon={Package}
          title="Operatör Paneli"
          subtitle="Sadece atanan istasyon, aktif iş emri ve hızlı vardiya aksiyonları"
          actions={(
            <select
              className="mes-input h-10 w-auto min-w-[200px]"
              value={stationId}
              onChange={(e) => handleStationChange(e.target.value)}
            >
              {ACTIVE_STATION_DEFINITIONS.map((station) => (
                <option key={station.id} value={station.id}>{station.displayName}</option>
              ))}
            </select>
          )}
        />
        <div className="grid gap-3 sm:grid-cols-3">
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
        </div>
      </section>

      <OperatorShiftWidget
        user={currentUser}
        notify={notify}
        canCreateAlarms={canCreateAlarms}
        stationId={stationId}
        onStationChange={handleStationChange}
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

      <div className="grid gap-5 lg:grid-cols-2">
        <ProductionForm
          {...form}
          istasyonAdi={stationId}
          onChangeStation={(event) => handleStationChange(event.target.value)}
          canSubmit={canSubmit}
          hideStationSelect
        />
        <section className="mes-surface p-5">
          <CardHeader icon={History} title="Son İstasyon Kayıtları" subtitle="En yeni 6 kayıt" />
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {stationRecords.slice(0, 6).map((record) => (
              <li key={record.id} className="flex items-center justify-between rounded-lg border border-[color:var(--color-line)] px-3 py-2 text-sm">
                <span className="truncate font-medium">{record.urun20liKod}</span>
                <span className={record.kaliteDurumu === 'OK' ? 'mes-pill-ok' : 'mes-pill-nok'}>{record.kaliteDurumu}</span>
              </li>
            ))}
            {stationRecords.length === 0 && (
              <li className="text-sm text-[color:var(--color-muted)]">Henüz kayıt yok.</li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
};

export default OperatorDashboardPage;
