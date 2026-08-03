import { BarChart3, Cpu } from 'lucide-react';
import {
  Bar,
  BarChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import StationDetailPanel from '../components/StationDetailPanel';

const StationsPage = ({
  stationChartData,
  stationDetailOptions,
  selectedStation,
  onStationChange,
  stationMetrics,
  recentRecords,
  stations,
  records,
}) => (
  <>
    <section className="custom-card">
      <div className="card-header">
        <BarChart3 className="text-primary" size={20} />
        <span>İstasyon Bazlı Üretim Hacmi Analizi</span>
      </div>
      <div style={{ width: '100%', height: '380px' }}>
        {stationChartData.length === 0 ? (
          <p style={{ textAlign: 'center', paddingTop: '100px', color: '#94a3b8' }}>Grafik verisi bulunamadı.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stationChartData} margin={{ top: 20, right: 30, left: 0, bottom: 80 }}>
              <XAxis dataKey="name" interval={0} angle={-35} textAnchor="end" tick={{ fontSize: 11, fill: '#475569' }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend verticalAlign="top" height={36} />
              <Bar dataKey="OK" fill="#10b981" name="Başarılı (OK)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="NOK" fill="#ef4444" name="Hatalı (NOK)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>

    <StationDetailPanel
      stationsList={stationDetailOptions}
      selectedStation={selectedStation}
      onStationChange={onStationChange}
      stationMetrics={stationMetrics}
      recentRecords={recentRecords}
    />

    <section className="custom-card">
      <div className="card-header">
        <Cpu className="text-primary" size={20} />
        <span>Saha İstasyon Performansı ve İş Yükü</span>
      </div>
      <div className="table-wrapper">
        <table className="modern-table">
          <thead>
            <tr>
              <th>İstasyon Adı</th>
              <th>Toplam İşlenen Ürün</th>
              <th>Başarılı (OK)</th>
              <th>Hatalı (NOK)</th>
              <th>İstasyon Verimliliği</th>
            </tr>
          </thead>
          <tbody>
            {stations.length === 0 ? (
              <tr><td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>Veri bulunamadı.</td></tr>
            ) : stations.map((stationName) => {
              const stationRecords = records.filter((record) => record.istasyonAdi === stationName);
              const total = stationRecords.length;
              const ok = stationRecords.filter((record) => record.kaliteDurumu === 'OK').length;
              const nok = stationRecords.filter((record) => record.kaliteDurumu === 'NOK').length;
              const rate = total > 0 ? ((ok / total) * 100).toFixed(1) : 0;
              return (
                <tr key={stationName}>
                  <td><b>{stationName}</b></td>
                  <td>{total} adet</td>
                  <td style={{ color: '#10b981', fontWeight: 'bold' }}>{ok}</td>
                  <td style={{ color: '#ef4444', fontWeight: 'bold' }}>{nok}</td>
                  <td>
                    <span className="badge" style={{ backgroundColor: rate >= 80 ? '#d1fae5' : '#fef3c7', color: rate >= 80 ? '#065f46' : '#b45309' }}>
                      %{rate}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  </>
);

export default StationsPage;
