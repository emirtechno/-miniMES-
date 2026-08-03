import { PackageSearch } from 'lucide-react';
import CardHeader from './CardHeader';
import { getStationDisplayName } from '../constants/stations';

const statusClass = (status) => {
  if (status === 'Tamamlandı') return 'mes-pill-ok';
  if (status === 'İşlemde') return 'mes-pill-warn';
  return 'mes-pill-neutral';
};

/**
 * Read-only lot/batch traceability — produced qty & status come from DB telemetry.
 */
const TraceabilityPanel = ({ batches = [] }) => (
  <section className="mes-surface p-5">
    <CardHeader
      icon={PackageSearch}
      title="Parti / Lot İzlenebilirliği"
      subtitle="Üretilen miktar aktif istasyonun Live Stream OK sayaçlarından otomatik hesaplanır"
    />

    <div className="overflow-x-auto">
      {batches.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[color:var(--color-line)] bg-slate-50 px-4 py-8 text-center text-sm text-[color:var(--color-muted)]">
          Henüz parti kaydı yok.
        </p>
      ) : (
        <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-[color:var(--color-muted)]">
              <th className="border-b border-[color:var(--color-line)] px-2 py-2">Lot No</th>
              <th className="border-b border-[color:var(--color-line)] px-2 py-2">Ürün</th>
              <th className="border-b border-[color:var(--color-line)] px-2 py-2">İstasyon</th>
              <th className="border-b border-[color:var(--color-line)] px-2 py-2">Hedef</th>
              <th className="border-b border-[color:var(--color-line)] px-2 py-2">Üretilen</th>
              <th className="border-b border-[color:var(--color-line)] px-2 py-2">İlerleme</th>
              <th className="border-b border-[color:var(--color-line)] px-2 py-2">Durum</th>
              <th className="border-b border-[color:var(--color-line)] px-2 py-2">Güncelleme</th>
            </tr>
          </thead>
          <tbody>
            {batches.map((batch) => {
              const progress = Number(batch.progressPercent ?? 0);
              const target = Math.max(0, Number(batch.targetQuantity) || 0);
              const produced = Math.max(0, Number(batch.producedQuantity) || 0);
              return (
                <tr key={batch.id}>
                  <td className="border-b border-[color:var(--color-line)] px-2 py-3"><b>{batch.lotNo}</b></td>
                  <td className="border-b border-[color:var(--color-line)] px-2 py-3">{batch.product}</td>
                  <td className="border-b border-[color:var(--color-line)] px-2 py-3">{getStationDisplayName(batch.station)}</td>
                  <td className="border-b border-[color:var(--color-line)] px-2 py-3">{target}</td>
                  <td className="border-b border-[color:var(--color-line)] px-2 py-3 font-semibold">{produced}</td>
                  <td className="border-b border-[color:var(--color-line)] min-w-[140px] px-2 py-3">
                    <div className="flex items-center gap-2">
                      <div className="mes-progress flex-1">
                        <span style={{ width: `${Math.min(100, progress)}%` }} />
                      </div>
                      <span className="w-12 text-right text-xs font-semibold">%{progress.toFixed(0)}</span>
                    </div>
                  </td>
                  <td className="border-b border-[color:var(--color-line)] px-2 py-3">
                    <span className={statusClass(batch.status)}>{batch.status}</span>
                  </td>
                  <td className="border-b border-[color:var(--color-line)] px-2 py-3 text-xs text-[color:var(--color-muted)]">
                    {batch.updatedAt ? new Date(batch.updatedAt).toLocaleString('tr-TR') : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  </section>
);

export default TraceabilityPanel;
