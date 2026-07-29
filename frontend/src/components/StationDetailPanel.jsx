import { Activity, CheckCircle2, Clock3, XCircle } from 'lucide-react';

const StationDetailPanel = ({ stationsList, selectedStation, onStationChange, stationMetrics, recentRecords }) => {
  return (
    <section className="custom-card">
      <div className="card-header" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Activity size={20} />
          <span>İstasyon Detay Görünümü</span>
        </div>

        <select className="input-field" value={selectedStation} onChange={onStationChange}>
          {stationsList.map((station) => (
            <option key={station} value={station}>
              {station}
            </option>
          ))}
        </select>
      </div>

      <div className="detail-grid">
        <div className="info-card">
          <div className="info-card-title">Toplam İşlenen</div>
          <div className="info-card-value">{stationMetrics.total}</div>
        </div>
        <div className="info-card">
          <div className="info-card-title">Başarılı (OK)</div>
          <div className="info-card-value success">{stationMetrics.ok}</div>
        </div>
        <div className="info-card">
          <div className="info-card-title">Hatalı (NOK)</div>
          <div className="info-card-value danger">{stationMetrics.nok}</div>
        </div>
        <div className="info-card">
          <div className="info-card-title">Verimlilik</div>
          <div className="info-card-value warning">%{stationMetrics.yield}</div>
        </div>
      </div>

      <div className="detail-list">
        <div className="detail-list-header">
          <Clock3 size={16} />
          <span>Son kayıtlar</span>
        </div>

        {recentRecords.length === 0 ? (
          <p className="empty-state">Bu istasyon için henüz kayıt yok.</p>
        ) : (
          recentRecords.map((record) => (
            <div key={record.id} className="detail-list-item">
              <div>
                <div className="detail-item-title">{record.urun20liKod}</div>
                <div className="detail-item-subtitle">{record.malzeme12liKod}</div>
              </div>
              <span className={`badge ${record.kaliteDurumu === 'OK' ? 'badge-ok' : 'badge-nok'}`}>
                {record.kaliteDurumu === 'OK' ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                {record.kaliteDurumu}
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  );
};

export default StationDetailPanel;
