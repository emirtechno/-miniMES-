import { ClipboardList, PlusCircle, ArrowRight, WandSparkles } from 'lucide-react';
import { ACTIVE_STATION_DEFINITIONS, getStationDisplayName } from '../constants/stations';
import CardHeader from './CardHeader';

const WorkOrderBoard = ({
  workOrders,
  formValues,
  onFieldChange,
  onSubmit,
  onAdvance,
  onCreateSample,
  creatingSample = false,
}) => (
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
            <th>Miktar</th>
            <th>Durum</th>
            <th>Aksiyon</th>
          </tr>
        </thead>
        <tbody>
          {workOrders.map((order) => (
            <tr key={order.id}>
              <td><b>{order.orderNo}</b></td>
              <td>{order.product}</td>
              <td>{getStationDisplayName(order.station)}</td>
              <td>{order.quantity}</td>
              <td>
                <span className={`badge ${order.status === 'Tamamlandı' ? 'badge-ok' : order.status === 'Devam Ediyor' ? 'badge-warning' : 'badge-neutral'}`}>
                  {order.status}
                </span>
              </td>
              <td>
                <button type="button" className="mes-btn-secondary" onClick={() => onAdvance(order)} title="Durumu ilerlet">
                  <ArrowRight size={16} />
                  İlerlet
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
);

export default WorkOrderBoard;
