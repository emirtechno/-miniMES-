import { PackageSearch } from 'lucide-react';
import { getStationDisplayName } from '../constants/stations';

const TraceabilityPanel = ({ batches }) => (
  <section className="custom-card">
    <div className="card-header">
      <PackageSearch size={18} />
      <span>Parti / Lot İzlenebilirliği</span>
    </div>

    <div className="table-wrapper">
      {(!batches || batches.length === 0) ? (
        <p className="empty-state" style={{ padding: '24px', textAlign: 'center' }}>
          Henüz parti kaydı yok. Geliştirme ortamında API yeniden başlatıldığında örnek lotlar eklenir.
        </p>
      ) : (
        <table className="modern-table">
          <thead>
            <tr>
              <th>Lot No</th>
              <th>Ürün</th>
              <th>İstasyon</th>
              <th>Durum</th>
              <th>Son Güncelleme</th>
            </tr>
          </thead>
          <tbody>
            {batches.map((batch) => (
              <tr key={batch.id}>
                <td><b>{batch.lotNo}</b></td>
                <td>{batch.product}</td>
                <td>{getStationDisplayName(batch.station)}</td>
                <td>
                  <span className={`badge ${batch.status === 'Tamamlandı' ? 'badge-ok' : batch.status === 'İşlemde' ? 'badge-warning' : 'badge-neutral'}`}>
                    {batch.status}
                  </span>
                </td>
                <td>{batch.updatedAt ? new Date(batch.updatedAt).toLocaleString('tr-TR') : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  </section>
);

export default TraceabilityPanel;
