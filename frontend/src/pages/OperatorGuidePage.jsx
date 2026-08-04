import { BookOpen, Factory, Gauge, HardHat, Monitor, Radio, Shield, Wrench } from 'lucide-react';
import { Link } from 'react-router-dom';

const sections = [
  {
    icon: Factory,
    title: 'Fabrika Genel Bakış',
    path: '/fabrika',
    body: 'Σ Actual / Σ Good / Σ Fire ve OEE, MachineMetrics özetinden gelir. 1-by-1 barkod sayacı yoktur.',
  },
  {
    icon: HardHat,
    title: 'Operatör Paneli',
    path: '/operator',
    body: 'Vardiya Başlat Live Stream’i açar; birden fazla hat aynı anda çalışabilir. “Fabrika Simülasyonu Başlat” tüm üretim hatlarında rastgele iş emri + parti oluşturur; hedef miktara ulaşınca hat otomatik kapanır.',
  },
  {
    icon: Wrench,
    title: 'İstasyonlar',
    path: '/istasyonlar',
    body: 'Kart KPI’ları telemetri aggregate + sıcaklık/RPM/OEE. Detayı Aç → Makine Metrikleri.',
  },
  {
    icon: Shield,
    title: 'Kalite Raporları',
    path: '/kalite',
    body: 'Fire listesi Actual−Good > 0 olan MachineMetrics tick’leridir. Lot progress Σ Good ile senkron.',
  },
  {
    icon: Gauge,
    title: 'Makine Metrikleri',
    path: '/makine-metrikleri',
    body: 'SSOT hub: trend, tablo, OEE, lot. Live Stream durumu vardiyaya bağlıdır.',
  },
  {
    icon: Monitor,
    title: 'Andon',
    path: '/andon',
    body: 'OEE latest + Live Stream anomali alarmları (SignalR).',
  },
];

const OperatorGuidePage = () => (
  <div className="mx-auto flex max-w-4xl flex-col gap-5">
    <section className="mes-surface p-6">
      <div className="flex items-start gap-3">
        <BookOpen className="mt-1 text-[color:var(--color-vestel)]" size={24} />
        <div>
          <h1 className="font-display m-0 text-3xl font-semibold tracking-wide">Kullanım Kılavuzu</h1>
          <p className="mes-helper mt-2 mb-0 max-w-2xl">
            Tüm KPI’lar MachineMetrics telemetri akışından türetilir. Barkod 1-by-1 üretim formu kaldırılmıştır.
          </p>
        </div>
      </div>
    </section>

    <section className="grid gap-4">
      {sections.map(({ icon: Icon, title, path, body }) => (
        <article key={path} className="mes-surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                <Icon size={18} />
              </span>
              <div>
                <h2 className="mes-section-title m-0">{title}</h2>
                <p className="mes-helper mt-2 mb-0">{body}</p>
              </div>
            </div>
            <Link to={path} className="mes-btn-secondary">Ekrana Git</Link>
          </div>
        </article>
      ))}
    </section>

    <section className="mes-surface p-5">
      <h2 className="mes-section-title m-0">Akış</h2>
      <ol className="mt-3 space-y-2 text-sm">
        <li>1. Vardiya Başlat / “Başka Hat Başlat” veya “Fabrika Simülasyonu Başlat” (tüm üretim hatları + rastgele WO/parti)</li>
        <li>2. Live Stream → her aktif hatta POST MachineMetrics (batch Actual/Good/Downtime)</li>
        <li>3. Summary / OEE / Lot / Andon senkron güncellenir; parti hedefi dolunca lot + iş emri tamamlanır</li>
        <li>4. Vardiya Bitir (tek hat) veya Tüm Hatları Durdur; hedef dolunca hat otomatik kapanır</li>
      </ol>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link to="/sistem" className="mes-btn-primary"><Radio size={16} /> Sistem Akışı</Link>
      </div>
    </section>
  </div>
);

export default OperatorGuidePage;
