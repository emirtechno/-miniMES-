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
  <div className="flex flex-col gap-5">
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard title="Toplam Üretim" value={metrics.totalCount} icon={Activity} accent={{ bg: '#e0f2fe', color: '#1769aa' }} />
      <KpiCard title="Başarılı (OK)" value={metrics.okCount} icon={CheckCircle2} accent={{ bg: '#d1fae5', color: '#0f9f6e' }} valueColor="#0f9f6e" />
      <KpiCard title="Hatalı (NOK)" value={metrics.nokCount} icon={XCircle} accent={{ bg: '#fee2e2', color: '#d92d20' }} valueColor="#d92d20" />
      <KpiCard title="Verimlilik Oranı" value={`%${metrics.yieldRate}`} icon={Percent} accent={{ bg: '#fef3c7', color: '#c47f17' }} valueColor="#c47f17" />
    </section>

    <OeePanel stationId={isCanonicalStation(table.selectedStation) ? table.selectedStation : DEFAULT_STATION} />

    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
      <div
        className="mes-surface p-5"
        style={{ borderLeft: !permission.isActive ? '4px solid #d92d20' : '4px solid #1769aa' }}
      >
        <div className="text-sm font-semibold text-[color:var(--color-ink)]">Aktif Kullanıcı Yetkisi</div>
        <p className={`mb-0 mt-2 text-sm ${!permission.isActive ? 'font-semibold text-[color:var(--color-nok)]' : 'text-[color:var(--color-muted)]'}`}>
          {permission.text}
        </p>
      </div>

      <ProductionForm {...form} />

      <section className="mes-surface flex flex-col p-5">
        <div className="mb-3 flex items-center gap-2">
          <PieIcon className="text-[color:var(--color-vestel)]" size={20} />
          <span className="mes-section-title">Kalite Dağılım Grafiği</span>
        </div>
        <div className="min-h-[260px] w-full flex-1">
          {metrics.totalCount === 0 ? (
            <p className="pt-20 text-center text-[color:var(--color-muted)]">Grafik için henüz veri yok.</p>
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
      <div className="flex justify-center">
        <button type="button" className="mes-btn-secondary" onClick={pagination.loadMore} disabled={pagination.loading}>
          {pagination.loading ? 'Yükleniyor...' : 'Daha Fazla Kayıt Yükle'}
        </button>
      </div>
    )}
  </div>
);

export default DashboardPage;
