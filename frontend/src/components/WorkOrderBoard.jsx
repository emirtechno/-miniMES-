import { useState } from 'react';
import {
  ClipboardList,
  PlusCircle,
  ArrowRight,
  Undo2,
  WandSparkles,
  ChevronDown,
  ChevronRight,
  History,
  Trash2,
} from 'lucide-react';
import { ACTIVE_STATION_DEFINITIONS, getStationDisplayName } from '../constants/stations';
import CardHeader from './CardHeader';

const statusBadgeClass = (status) => {
  if (status === 'Tamamlandı') return 'badge-ok';
  if (status === 'Devam Ediyor') return 'badge-warning';
  if (status === 'Arşivlendi') return 'badge-neutral';
  return 'badge-neutral';
};

// NEDEN: İş emri panosu — aktif (Arşivlendi hariç) + geçmiş (Arşivlendi). Soft-delete ayrı (toast geri al).
// NASIL: İlerlet = advance; geçmişten geri = restore; sil = DeletedAt soft-delete. Lot/batch yok.
const WorkOrderRow = ({ order, action }) => {
  const completed = Number(order.completedQuantity ?? 0);
  const target = Math.max(1, Number(order.quantity) || 1);
  const progress = Number(order.progressPercent ?? Math.min(100, (completed * 100) / target));

  return (
    <tr>
      <td>
        <b>{order.orderNo}</b>
      </td>
      <td>{order.product}</td>
      <td>{getStationDisplayName(order.station)}</td>
      <td>{completed} / {order.quantity}</td>
      <td className="min-w-[120px]">
        <div className="flex items-center gap-2">
          <div className="mes-progress flex-1">
            <span style={{ width: `${Math.min(100, progress)}%` }} />
          </div>
          <span className="w-10 text-right text-xs font-semibold">%{progress.toFixed(0)}</span>
        </div>
      </td>
      <td>
        <span className={`badge ${statusBadgeClass(order.status)}`}>
          {order.status}
        </span>
      </td>
      <td>{action}</td>
    </tr>
  );
};

const ActionGroup = ({ children }) => (
  <div className="flex flex-wrap items-center gap-2">
    {children}
  </div>
);

const WorkOrderBoard = ({
  workOrders,
  historyWorkOrders = [],
  formValues,
  onFieldChange,
  onSubmit,
  onAdvance,
  onRestore,
  onDelete,
  onCreateSample,
  creatingSample = false,
}) => {
  const [historyOpen, setHistoryOpen] = useState(false);
  // NEDEN: Aktif tabloda Arşivlendi gösterilmez — geçmiş bölümünde (historyWorkOrders).
  const activeOrders = workOrders.filter((order) => order.status !== 'Arşivlendi');

  return (
    <section className="mes-surface p-5">
      <CardHeader
        icon={ClipboardList}
        title="İş Emri Takibi"
        subtitle="Manuel giriş veya tek tıkla test iş emri"
        actions={onCreateSample ? (
          <button type="button" className="mes-btn-primary" onClick={onCreateSample} disabled={creatingSample}>
            <WandSparkles size={16} />
            {creatingSample ? 'Oluşturuluyor...' : 'Otomatik Test İş Emri Oluştur'}
          </button>
        ) : null}
      />

      <form onSubmit={onSubmit} className="mb-5 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
        <input className="mes-input" placeholder="İş Emri No" value={formValues.orderNo} onChange={(e) => onFieldChange('orderNo', e.target.value)} minLength={3} required />
        <input className="mes-input" placeholder="Ürün" value={formValues.product} onChange={(e) => onFieldChange('product', e.target.value)} minLength={3} required />
        <select className="mes-input" value={formValues.station} onChange={(e) => onFieldChange('station', e.target.value)} required>
          <option value="">İstasyon seçin</option>
          {ACTIVE_STATION_DEFINITIONS.map((station) => (
            <option key={station.id} value={station.id}>{station.displayName}</option>
          ))}
        </select>
        <input className="mes-input" placeholder="Miktar" value={formValues.quantity} onChange={(e) => onFieldChange('quantity', e.target.value)} required />
        <button type="submit" className="mes-btn-primary">
          <PlusCircle size={16} />
          Ekle
        </button>
      </form>

      <div className="overflow-x-auto">
        <table className="modern-table">
          <thead>
            <tr>
              <th>İş Emri</th>
              <th>Ürün</th>
              <th>İstasyon</th>
              <th>Tamamlanan / Hedef</th>
              <th>İlerleme</th>
              <th>Durum</th>
              <th>Aksiyon</th>
            </tr>
          </thead>
          <tbody>
            {activeOrders.map((order) => {
              const isCompleted = order.status === 'Tamamlandı';
              return (
                <WorkOrderRow
                  key={order.id}
                  order={order}
                  action={(
                    <ActionGroup>
                      <button
                        type="button"
                        className="mes-btn-secondary"
                        onClick={() => onAdvance(order)}
                        title={isCompleted ? 'Plan geçmişine gönder' : 'Durumu ilerlet'}
                      >
                        <ArrowRight size={16} />
                        {isCompleted ? 'Geçmişe gönder' : 'İlerlet'}
                      </button>
                      {onDelete ? (
                        <button
                          type="button"
                          className="mes-btn-danger"
                          onClick={() => onDelete(order)}
                          title="İş emrini sil"
                        >
                          <Trash2 size={16} />
                          Sil
                        </button>
                      ) : null}
                    </ActionGroup>
                  )}
                />
              );
            })}
            {activeOrders.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-sm text-[color:var(--color-muted)]">
                  Aktif iş emri yok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-5 rounded-lg border border-[color:var(--color-line)]">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm"
          onClick={() => setHistoryOpen((open) => !open)}
          aria-expanded={historyOpen}
        >
          <span className="inline-flex items-center gap-2 font-medium">
            {historyOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <History size={16} className="text-[color:var(--color-muted)]" />
            Plan Geçmişi
            <span className="text-[color:var(--color-muted)]">({historyWorkOrders.length})</span>
          </span>
          <span className="text-xs text-[color:var(--color-muted)]">
            Tamamlanan iş emirlerini arşivden geri alabilirsiniz
          </span>
        </button>
        {historyOpen && (
          <div className="overflow-x-auto border-t border-[color:var(--color-line)] px-2 pb-2 pt-1">
            <table className="modern-table">
              <thead>
                <tr>
                  <th>İş Emri</th>
                  <th>Ürün</th>
                  <th>İstasyon</th>
                  <th>Tamamlanan / Hedef</th>
                  <th>İlerleme</th>
                  <th>Durum</th>
                  <th>Aksiyon</th>
                </tr>
              </thead>
              <tbody>
                {historyWorkOrders.map((order) => (
                  <WorkOrderRow
                    key={order.id}
                    order={order}
                    action={(
                      <ActionGroup>
                        {onRestore ? (
                          <button
                            type="button"
                            className="mes-btn-secondary"
                            onClick={() => onRestore(order)}
                            title="Aktif tahtaya geri al"
                          >
                            <Undo2 size={16} />
                            Geri al
                          </button>
                        ) : null}
                        {onDelete ? (
                          <button
                            type="button"
                            className="mes-btn-danger"
                            onClick={() => onDelete(order)}
                            title="İş emrini sil"
                          >
                            <Trash2 size={16} />
                            Sil
                          </button>
                        ) : null}
                        {!onRestore && !onDelete ? (
                          <span className="text-xs text-[color:var(--color-muted)]">—</span>
                        ) : null}
                      </ActionGroup>
                    )}
                  />
                ))}
                {historyWorkOrders.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-sm text-[color:var(--color-muted)]">
                      Plan geçmişi boş.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};

export default WorkOrderBoard;
