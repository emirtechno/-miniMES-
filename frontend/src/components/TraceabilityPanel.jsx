import { PackageSearch, ScanLine } from 'lucide-react';

const TraceabilityPanel = ({ batches }) => {
  return (
    <section className="custom-card">
      <div className="card-header">
        <PackageSearch size={18} />
        <span> Parti / Lot İzlenebilirliği</span>
      </div>

      <div className="table-wrapper">
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
                <td>{batch.station}</td>
                <td>
                  <span className={`badge ${batch.status === 'Tamamlandı' ? 'badge-ok' : batch.status === 'İşlemde' ? 'badge-warning' : 'badge-neutral'}`}>
                    {batch.status}
                  </span>
                </td>
                <td>{batch.updatedAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default TraceabilityPanel;
