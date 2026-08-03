import { ClipboardList, PlusCircle, ArrowRight, WandSparkles } from 'lucide-react';
import { ACTIVE_STATION_DEFINITIONS, getStationDisplayName } from '../constants/stations';

const WorkOrderBoard = ({
  workOrders,
  formValues,
  onFieldChange,
  onSubmit,
  onAdvance,
  onCreateSample,
  creatingSample = false,
}) => (
  <section className="custom-card">
    <div className="card-header" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <ClipboardList size={20} />
        <span>İş Emri Takibi</span>
      </div>
      {onCreateSample && (
        <button
          type="button"
          className="btn-primary"
          onClick={onCreateSample}
          disabled={creatingSample}
          title="Tek tıkla örnek iş emri oluşturur"
        >
          <WandSparkles size={16} />
          {creatingSample ? 'Oluşturuluyor...' : 'Otomatik Test İş Emri Oluştur'}
        </button>
      )}
    </div>

    <form onSubmit={onSubmit} className="form-grid" style={{ marginBottom: '20px' }}>
      <div className="input-group">
        <label>İş Emri No</label>
        <input className="input-field" value={formValues.orderNo} onChange={(e) => onFieldChange('orderNo', e.target.value)} minLength={3} required />
      </div>
      <div className="input-group">
        <label>Ürün</label>
        <input className="input-field" value={formValues.product} onChange={(e) => onFieldChange('product', e.target.value)} minLength={3} required />
      </div>
      <div className="input-group">
        <label>İstasyon</label>
        <select className="input-field" value={formValues.station} onChange={(e) => onFieldChange('station', e.target.value)} required>
          <option value="">İstasyon seçin</option>
          {ACTIVE_STATION_DEFINITIONS.map((station) => (
            <option key={station.id} value={station.id}>{station.displayName}</option>
          ))}
        </select>
      </div>
      <div className="input-group">
        <label>Miktar</label>
        <input className="input-field" value={formValues.quantity} onChange={(e) => onFieldChange('quantity', e.target.value)} required />
      </div>
      <button type="submit" className="btn-primary">
        <PlusCircle size={18} />
        Ekle
      </button>
    </form>

    <div className="table-wrapper">
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
                <button className="btn-delete" onClick={() => onAdvance(order)} title="Durumu ilerlet">
                  <ArrowRight size={18} />
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
