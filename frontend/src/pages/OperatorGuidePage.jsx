import { BookOpen, Factory, Gauge, HardHat, Monitor, Radio, Shield, Wrench } from 'lucide-react';
import { Link } from 'react-router-dom';

const sections = [
  {
    icon: Factory,
    title: 'Fabrika Genel Bakış',
    path: '/fabrika',
    body: 'Yönetici komuta merkezi. Hatlar arası OEE, durum şeridi ve OK/NOK hacmi Live Stream telemetrisinden beslenir.',
  },
  {
    icon: HardHat,
    title: 'Operatör Paneli',
    path: '/operator',
    body: 'Vardiya Başlat ile Live Stream motorunu açarsınız. Manuel barkod formu yoktur — OK/NOK ve lot ilerleme sensör olaylarından gelir. Duruş/setup Live Stream’i duraklatır.',
  },
  {
    icon: Wrench,
    title: 'İstasyonlar',
    path: '/istasyonlar',
    body: 'Kartlar sıcaklık, RPM, titreşim, OK/NOK ve OEE gösterir. “Detayı Aç” Makine Metrikleri’ne istasyon filtresiyle gider.',
  },
  {
    icon: Shield,
    title: 'Kalite Raporları',
    path: '/kalite',
    body: 'İş emirleri, Andon alarmları, lot izlenebilirlik. Telemetri kayıtları silinmez; yetkili kullanıcı yalnızca NOK→OK sınıflandırması yapabilir.',
  },
  {
    icon: Gauge,
    title: 'Makine Metrikleri',
    path: '/makine-metrikleri',
    body: 'Merkezi telemetri hub’ı. Vardiya ile senkron Live Stream; OEE, lot progress ve Andon anomali eşikleri burada birleşir.',
  },
  {
    icon: Monitor,
    title: 'Andon Ekranı',
    path: '/andon',
    body: 'Yüksek titreşim, aşırı ısınma, duruş eşiği ve NOK spike alarmları Live Stream’den SignalR ile düşer.',
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
            Mimari tamamen sensör / PLC telemetrisi ve vardiya odaklı Live Stream üzerine kuruludur.
            Manuel üretim kaydı veya çöp kutusu yoktur.
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
            <Link to={path} className="mes-btn-secondary">
              Ekrana Git
            </Link>
          </div>
        </article>
      ))}
    </section>

    <section className="mes-surface p-5">
      <h2 className="mes-section-title m-0">Ana akış</h2>
      <ol className="mt-3 space-y-2 text-sm text-[color:var(--color-ink)]">
        <li><strong>1. Vardiya Başlat</strong> — Operatör Paneli / Shift Widget.</li>
        <li><strong>2. Live Stream</strong> — Makine telemetrisi OK·NOK, sıcaklık/RPM/titreşim üretir.</li>
        <li><strong>3. Lot & OEE</strong> — Parti ilerleme çubukları ve vardiya OEE anlık güncellenir.</li>
        <li><strong>4. Andon</strong> — Anomali eşikleri alarm yaratır; SignalR ile büyük ekrana düşer.</li>
        <li><strong>5. Vardiya Bitir</strong> — Live Stream durur.</li>
      </ol>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link to="/sistem" className="mes-btn-primary">
          <Radio size={16} />
          Sistem Akışı
        </Link>
        <Link to="/operator" className="mes-btn-secondary">
          Operatör Paneli
        </Link>
      </div>
    </section>
  </div>
);

export default OperatorGuidePage;
