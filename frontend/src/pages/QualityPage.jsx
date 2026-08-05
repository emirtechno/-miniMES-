import { XCircle } from 'lucide-react';
import AlarmPanel from '../components/AlarmPanel';
import TraceabilityPanel from '../components/TraceabilityPanel';
import WorkOrderBoard from '../components/WorkOrderBoard';
import CardHeader from '../components/CardHeader';
import { getStationDisplayName } from '../constants/stations';

/**
 * Quality / lot / alarms — scrap derived from MachineMetrics (Actual − Good), not 1-by-1 barcodes.
 * User admin and manual alarm create live on /yonetim.
 */
const QualityPage = ({
  workOrders,
  alarms,
  batches,
  scrapTicks = [],
  plantKpi = { good: 0, nok: 0, actual: 0, yield: 0 },
  permissions,
  workOrderForm,
}) => (
  <div className="flex flex-col gap-5">
    <WorkOrderBoard
      workOrders={workOrders.items}
      formValues={workOrderForm.values}
      onFieldChange={workOrderForm.onFieldChange}
      onSubmit={permissions.canManageWorkOrders ? workOrderForm.onSubmit : workOrderForm.onDenied}
      onAdvance={permissions.canManageWorkOrders ? workOrders.onAdvance : workOrderForm.onDenied}
      onCreateSample={permissions.canManageWorkOrders ? workOrders.onCreateSample : undefined}
      creatingSample={workOrders.creatingSample}
      disabled={!permissions.canManageWorkOrders}
    />

    <section className="grid gap-3 sm:grid-cols-3">
      <div className="mes-surface p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">Σ Gerçekleşen</div>
        <div className="font-display mt-1 text-3xl font-semibold">{plantKpi.actual || 0}</div>
      </div>
      <div className="mes-surface p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Σ Sağlam</div>
        <div className="font-display mt-1 text-3xl font-semibold text-emerald-800">{plantKpi.good || 0}</div>
      </div>
      <div className="mes-surface p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-red-800">Σ Fire · Verim</div>
        <div className="font-display mt-1 text-3xl font-semibold text-red-800">
          {plantKpi.nok || 0}
          <span className="ml-2 text-lg text-[color:var(--color-muted)]">%{plantKpi.yield || 0}</span>
        </div>
      </div>
    </section>

    <AlarmPanel
      alarms={alarms.items}
      onAcknowledge={permissions.canManageAlarms ? alarms.onAcknowledge : undefined}
      onResolve={permissions.canManageAlarms ? alarms.onResolve : undefined}
    />

    <TraceabilityPanel
      batches={batches}
      subtitle="Kalite ana ekranı — tüm lotlar; üretilen miktar telemetri Good delta’larından"
    />

    <section className="mes-surface p-5">
      <CardHeader
        icon={XCircle}
        title={`Fire içeren telemetri tick’leri (${scrapTicks.length})`}
        subtitle="Actual − Good > 0 olan MachineMetrics satırları (barkod listesi yok)"
      />
      <div className="table-wrapper">
        <table className="modern-table">
          <thead>
            <tr>
              <th>İstasyon</th>
              <th>Gerçekleşen</th>
              <th>Sağlam</th>
              <th>Fire</th>
              <th>Duruş</th>
              <th>Zaman</th>
            </tr>
          </thead>
          <tbody>
            {scrapTicks.map((tick) => {
              const scrap = Math.max(0, (tick.actualProductionCount || 0) - (tick.goodProductionCount || 0));
              return (
                <tr key={`${tick.id}-${tick.recordedAt}`}>
                  <td>{getStationDisplayName(tick.stationId)}</td>
                  <td><b>{tick.actualProductionCount}</b></td>
                  <td className="text-emerald-700 font-semibold">{tick.goodProductionCount}</td>
                  <td className="text-red-700 font-semibold">{scrap}</td>
                  <td>{tick.downtimeSeconds} sn</td>
                  <td>{tick.recordedAt ? new Date(tick.recordedAt).toLocaleString('tr-TR') : '—'}</td>
                </tr>
              );
            })}
            {scrapTicks.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-sm text-[color:var(--color-muted)]">
                  Fire içeren telemetri tick’i yok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  </div>
);

export default QualityPage;
