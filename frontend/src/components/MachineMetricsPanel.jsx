import { useState, useEffect } from 'react';
import { Cpu } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { fetchMachineMetrics } from '../services/api';

const MachineMetricsPanel = () => {
  const [metrics, setMetrics] = useState([]);
  const [selectedStation, setSelectedStation] = useState('STATION-01');
  const [oeeData, setOeeData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await fetchMachineMetrics();
        setMetrics(Array.isArray(data) ? data : []);
        
        if (selectedStation && selectedStation !== 'Tümü') {
          const oeeRes = await fetch(`http://localhost:5000/api/Oee/latest/${selectedStation}`);
          if (oeeRes.ok) {
            const oeeJson = await oeeRes.json();
            setOeeData(oeeJson);
          }
        }
        
        setLoading(false);
      } catch (err) {
        console.error("Veriler çekilemedi:", err);
        setLoading(false);
      }
    };

    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [selectedStation]);

  const stationsList = ['Tümü', ...new Set(metrics.map(m => m.stationId).filter(Boolean))];

  const filteredMetrics = selectedStation === 'Tümü' 
    ? metrics 
    : metrics.filter(m => m.stationId === selectedStation);

  // Grafik için veriyi saate göre sırala ve hazırla
  const chartData = [...filteredMetrics].reverse().map(item => ({
    time: item.recordedAt ? new Date(item.recordedAt).toLocaleTimeString('tr-TR') : '',
    Gerceklesen: item.actualProductionCount,
    Saglam: item.goodProductionCount,
    Durus: item.downtimeSeconds
  }));

  return (
    <>
      {/* 🚀 OEE SKOR KARTLARI */}
      {oeeData && (
        <section className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: '20px' }}>
          <div className="custom-card" style={{ padding: '15px', borderLeft: '4px solid #3b82f6' }}>
            <div className="info-card-title">Genel OEE ({selectedStation})</div>
            <div className="info-card-value" style={{ fontSize: '1.6rem', color: '#3b82f6' }}>%{oeeData.oee}</div>
          </div>
          <div className="custom-card" style={{ padding: '15px', borderLeft: '4px solid #10b981' }}>
            <div className="info-card-title">Kullanılabilirlik</div>
            <div className="info-card-value" style={{ fontSize: '1.6rem', color: '#10b981' }}>%{oeeData.availability}</div>
          </div>
          <div className="custom-card" style={{ padding: '15px', borderLeft: '4px solid #f59e0b' }}>
            <div className="info-card-title">Performans</div>
            <div className="info-card-value" style={{ fontSize: '1.6rem', color: '#f59e0b' }}>%{oeeData.performance}</div>
          </div>
          <div className="custom-card" style={{ padding: '15px', borderLeft: '4px solid #8b5cf6' }}>
            <div className="info-card-title">Kalite Oranı</div>
            <div className="info-card-value" style={{ fontSize: '1.6rem', color: '#8b5cf6' }}>%{oeeData.quality}</div>
          </div>
        </section>
      )}

      {/* 📈 ÜRETİM TREND GRAFİĞİ */}
      <section className="custom-card" style={{ marginBottom: '20px', padding: '20px' }}>
        <div className="card-header" style={{ marginBottom: '15px' }}>
          <span>Zaman Bazlı Üretim ve Duruş Trendi ({selectedStation})</span>
        </div>
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="time" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="Gerceklesen" name="Gerçekleşen Üretim" stroke="#3b82f6" strokeWidth={2} />
              <Line type="monotone" dataKey="Saglam" name="Sağlam Ürün (OK)" stroke="#10b981" strokeWidth={2} />
              <Line type="monotone" dataKey="Durus" name="Duruş (sn)" stroke="#ef4444" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* 📊 TABLO KISMI */}
      <section className="custom-card">
        <div className="card-header" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Cpu className="text-primary" size={20} />
            <span>Makine Telemetri ve Periyodik Metrikler (SCADA / PLC)</span>
          </div>

          <select 
            className="input-field" 
            value={selectedStation} 
            onChange={(e) => setSelectedStation(e.target.value)}
            style={{ minWidth: '180px', background: '#fff' }}
          >
            <option value="Tümü">Tüm İstasyonlar</option>
            {stationsList.filter(s => s !== 'Tümü').map((station) => (
              <option key={station} value={station}>{station}</option>
            ))}
          </select>
        </div>

        <div className="table-wrapper" style={{ marginTop: '16px' }}>
          {filteredMetrics.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
              {loading ? "Veriler yükleniyor..." : "Bu istasyon için henüz makine metrik verisi bulunmuyor."}
            </p>
          ) : (
            <table className="modern-table">
              <thead>
                <tr>
                  <th>İstasyon</th>
                  <th>Planlanan Süre</th>
                  <th>Duruş (sn)</th>
                  <th>İdeal Çevrim</th>
                  <th>Gerçekleşen Üretim</th>
                  <th>Sağlam (OK)</th>
                  <th>Kayıt Zamanı</th>
                </tr>
              </thead>
              <tbody>
                {filteredMetrics.map((item, index) => (
                  <tr key={index}>
                    <td><b>{item.stationId}</b></td>
                    <td>{item.plannedProductionSeconds} sn</td>
                    <td style={{ color: item.downtimeSeconds > 30 ? '#ef4444' : 'inherit', fontWeight: item.downtimeSeconds > 30 ? 'bold' : 'normal' }}>
                      {item.downtimeSeconds} sn
                    </td>
                    <td>{item.idealCycleTimeSeconds} sn</td>
                    <td><b>{item.actualProductionCount}</b></td>
                    <td style={{ color: '#10b981', fontWeight: 'bold' }}>{item.goodProductionCount}</td>
                    <td style={{ color: '#64748b' }}>{item.recordedAt ? new Date(item.recordedAt).toLocaleTimeString('tr-TR') : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </>
  );
};

export default MachineMetricsPanel;