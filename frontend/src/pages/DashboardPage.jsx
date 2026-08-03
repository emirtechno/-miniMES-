import { Activity, CheckCircle2, Percent, XCircle } from 'lucide-react';
import KpiCard from '../components/KpiCard';
import OeePanel from '../components/OeePanel';
import ProductionForm from '../components/ProductionForm';
import ProductionTable from '../components/ProductionTable';
import QualityDistributionChart from '../components/QualityDistributionChart';
import { DEFAULT_STATION } from '../constants/stations';

const DashboardPage = ({
  metrics,
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

    {/* Isolated OEE / line-efficiency block — not part of the operator production form */}
    <section
      className="rounded-2xl border border-sky-200/80 bg-gradient-to-br from-sky-50/90 via-white to-white p-1 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
      aria-labelledby="oee-section-heading"
    >
      <div className="mb-1 flex flex-wrap items-end justify-between gap-2 px-4 pt-3">
        <div>
          <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-800/80">
            Hat Verimliliği · Telemetri
          </p>
          <h2 id="oee-section-heading" className="font-display m-0 text-xl font-semibold text-sky-950">
            OEE / Hat Verimliliği
          </h2>
          <p className="mes-helper mt-1 mb-0 max-w-2xl">
            Bu bölüm makine/hat telemetrisinden (API veya simülasyon) gelir. Aşağıdaki Üretim Paneli ise operatörün
            girdiği iş ve kalite kayıtlarıdır — karıştırılmamalıdır. İstasyon seçici ile farklı hatların OEE’sini görün.
          </p>
        </div>
      </div>
      <div className="px-1 pb-1">
        <OeePanel defaultStationId={DEFAULT_STATION} showStationSelector />
      </div>
    </section>

    <section
      className="rounded-2xl border border-[color:var(--color-line)] bg-white p-4 md:p-5"
      aria-labelledby="production-section-heading"
    >
      <div className="mb-4">
        <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)]">
          Operatör İş Akışı
        </p>
        <h2 id="production-section-heading" className="font-display m-0 text-xl font-semibold text-[color:var(--color-ink)]">
          Üretim Paneli
        </h2>
        <p className="mes-helper mt-1 mb-0">
          Barkod / malzeme girişi, kalite dağılımı ve üretim listesi. Veriler operatör aksiyonlarıyla oluşur.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ProductionForm {...form} />
        <QualityDistributionChart data={metrics.qualityChartData} totalCount={metrics.totalCount} />
      </div>

      <div className="mt-4">
        <ProductionTable {...table} />
        {pagination.hasMore && (
          <div className="mt-3 flex justify-center">
            <button type="button" className="mes-btn-secondary" onClick={pagination.loadMore} disabled={pagination.loading}>
              {pagination.loading ? 'Yükleniyor...' : 'Daha Fazla Kayıt Yükle'}
            </button>
          </div>
        )}
      </div>
    </section>
  </div>
);

export default DashboardPage;
