import { Activity, CheckCircle2, Percent, PieChart as PieIcon, XCircle } from 'lucide-react';
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import KpiCard from '../components/KpiCard';
import OeePanel from '../components/OeePanel';
import ProductionForm from '../components/ProductionForm';
import ProductionTable from '../components/ProductionTable';
import { DEFAULT_STATION, isCanonicalStation } from '../constants/stations';

const DashboardPage = ({
  metrics,
  permission,
  form,
  table,
  pagination,
}) => (
  <>
    <section className="kpi-grid">
      <KpiCard title="Toplam Üretim" value={metrics.totalCount} icon={Activity} accent={{ bg: '#e0f2fe', color: '#0284c7' }} />
      <KpiCard title="Başarılı (OK)" value={metrics.okCount} icon={CheckCircle2} accent={{ bg: '#d1fae5', color: '#10b981' }} valueColor="#10b981" />
      <KpiCard title="Hatalı (NOK)" value={metrics.nokCount} icon={XCircle} accent={{ bg: '#fee2e2', color: '#ef4444' }} valueColor="#ef4444" />
      <KpiCard title="Verimlilik Oranı" value={`%${metrics.yieldRate}`} icon={Percent} accent={{ bg: '#fef3c7', color: '#f59e0b' }} valueColor="#f59e0b" />
    </section>

    <OeePanel stationId={isCanonicalStation(table.selectedStation) ? table.selectedStation : DEFAULT_STATION} />

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px', marginBottom: '24px' }}>
      <div className="custom-card" style={{ marginBottom: 0, borderLeft: !permission.isActive ? '5px solid #ef4444' : '5px solid #0284c7' }}>
        <div className="card-header"><span>Aktif Kullanıcı Yetkisi</span></div>
        <p style={{ margin: 0, color: !permission.isActive ? '#ef4444' : '#475569', fontWeight: !permission.isActive ? 600 : 400 }}>
          {permission.text}
        </p>
      </div>

      <ProductionForm {...form} />

      <section className="custom-card" style={{ marginBottom: 0, display: 'flex', flexDirection: 'column' }}>
        <div className="card-header">
          <PieIcon className="text-primary" size={20} />
          <span>Kalite Dağılım Grafiği</span>
        </div>
        <div style={{ flex: 1, minHeight: '260px', width: '100%' }}>
          {metrics.totalCount === 0 ? (
            <p style={{ textAlign: 'center', paddingTop: '80px', color: '#94a3b8' }}>Grafik için henüz veri yok.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={metrics.qualityChartData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={5} dataKey="value">
                  {metrics.qualityChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${value} Adet`, 'Miktar']} />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>
    </div>

    <ProductionTable {...table} />
    {pagination.hasMore && (
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '12px' }}>
        <button type="button" className="btn-secondary" onClick={pagination.loadMore} disabled={pagination.loading}>
          {pagination.loading ? 'Yükleniyor...' : 'Daha Fazla Kayıt Yükle'}
        </button>
      </div>
    )}
  </>
);

export default DashboardPage;
