import { PackageSearch, Play, RotateCcw, CheckCircle2, Minus, Plus } from 'lucide-react';
import CardHeader from './CardHeader';
import { getStationDisplayName } from '../constants/stations';

const statusClass = (status) => {
  if (status === 'Tamamlandı') return 'mes-pill-ok';
  if (status === 'İşlemde') return 'mes-pill-warn';
  return 'mes-pill-neutral';
};

const TraceabilityPanel = ({
  batches = [],
  canManage = false,
  onAdvance,
  onReopen,
  onProgress,
  busyId = null,
}) => (
  <section className="mes-surface p-5">
    <CardHeader
      icon={PackageSearch}
      title="Parti / Lot İzlenebilirliği"
      subtitle="Hedef–üretim ilerlemesi ve durum yönetimi (Geri Al destekli)"
    />

    <div className="overflow-x-auto">
      {batches.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[color:var(--color-line)] bg-slate-50 px-4 py-8 text-center text-sm text-[color:var(--color-muted)]">
          Henüz parti kaydı yok.
        </p>
      ) : (
        <table className="w-full min-w-[920px] border-separate border-spacing-0 text-left text-sm">
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
              <th className="border-b border-[color:var(--color-line)] px-2 py-2">Aksiyon</th>
            </tr>
          </thead>
          <tbody>
            {batches.map((batch) => {
              const progress = Number(batch.progressPercent ?? 0);
              const busy = busyId === batch.id;
              const canEditQty = canManage && batch.status !== 'Tamamlandı' && onProgress;
              return (
                <tr key={batch.id}>
                  <td className="border-b border-[color:var(--color-line)] px-2 py-3"><b>{batch.lotNo}</b></td>
                  <td className="border-b border-[color:var(--color-line)] px-2 py-3">{batch.product}</td>
                  <td className="border-b border-[color:var(--color-line)] px-2 py-3">{getStationDisplayName(batch.station)}</td>
                  <td className="border-b border-[color:var(--color-line)] px-2 py-3">{batch.targetQuantity}</td>
                  <td className="border-b border-[color:var(--color-line)] px-2 py-3">
                    {canEditQty ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="mes-btn-ghost !h-8 !min-h-8 !px-2"
                          disabled={busy || batch.producedQuantity <= 0}
                          onClick={() => onProgress(batch, Math.max(0, (batch.producedQuantity || 0) - 1))}
                          title="Üretilen azalt"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="min-w-[2ch] text-center font-semibold">{batch.producedQuantity}</span>
                        <button
                          type="button"
                          className="mes-btn-ghost !h-8 !min-h-8 !px-2"
                          disabled={busy || batch.producedQuantity >= batch.targetQuantity}
                          onClick={() => onProgress(batch, Math.min(batch.targetQuantity, (batch.producedQuantity || 0) + 1))}
                          title="Üretilen artır"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    ) : (
                      batch.producedQuantity
                    )}
                  </td>
                  <td className="border-b border-[color:var(--color-line)] px-2 py-3 min-w-[140px]">
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
                  <td className="border-b border-[color:var(--color-line)] px-2 py-3">
                    {!canManage ? (
                      <span className="text-xs text-[color:var(--color-muted)]">—</span>
                    ) : batch.status === 'Tamamlandı' ? (
                      <button type="button" className="mes-btn-secondary" disabled={busy} onClick={() => onReopen?.(batch)}>
                        <RotateCcw size={16} />
                        Geri Al
                      </button>
                    ) : (
                      <button type="button" className="mes-btn-primary" disabled={busy} onClick={() => onAdvance?.(batch)}>
                        {batch.status === 'Bekliyor' ? <Play size={16} /> : <CheckCircle2 size={16} />}
                        {batch.status === 'Bekliyor' ? 'Başlat' : 'Tamamla'}
                      </button>
                    )}
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
