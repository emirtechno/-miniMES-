import { BookOpen, Factory, Gauge, HardHat, Monitor, Radio, Shield, Wrench } from 'lucide-react';
import { Link } from 'react-router-dom';

const sections = [
  {
    icon: Factory,
    title: 'Fabrika Genel Bakış',
    path: '/fabrika',
    body: 'Yönetici komuta merkezi. Hatlar arası OEE, durum şeridi, OK/NOK hacmi ve açık iş emirleri burada toplanır.',
  },
  {
    icon: HardHat,
    title: 'Operatör Paneli',
    path: '/operator',
    body: 'Günlük saha ekranı. Barkod / malzeme girişi, vardiya oturumu ve hızlı üretim kaydı. Kayıtlar API üzerinden SQL Server’a yazılır.',
  },
  {
    icon: Wrench,
    title: 'İstasyonlar',
    path: '/istasyonlar',
    body: 'Fabrika layout’u: montaj, elektronik, kalite, paketleme ve final kontrol hatları. Kart durumları canlı üretim kayıtlarından türetilir. “Detayı Aç” Makine Metrikleri’ne istasyon filtresiyle gider.',
  },
  {
    icon: Shield,
    title: 'Kalite Raporları',
    path: '/kalite',
    body: 'İş emirleri, alarmlar, izlenebilirlik ve (yetkiniz varsa) kullanıcı yönetimi burada. Alarm oluşturma / onaylama için alarms.write / alarms.manage yetkileri gerekir.',
  },
  {
    icon: Gauge,
    title: 'Makine Metrikleri',
    path: '/makine-metrikleri',
    body: 'Telemetri, OEE, lot ilerleme ve canlı simülasyon motoru. “Simülasyonu Çalıştır / Pause Live Stream” buradan yönetilir; OK·NOK, sıcaklık/RPM/titreşim ve alarmlar aynı akıştan beslenir.',
  },
  {
    icon: Monitor,
    title: 'Andon Ekranı',
    path: '/andon',
    body: 'Shop-floor büyük ekran. İstasyon OEE ve açık alarmlar SignalR ile canlı yenilenir. Operatör müdahalesi için değil; görünürlük içindir.',
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
            Bu kılavuz operatörler ve vardiya sorumluları için yazılmıştır. Teknik jargon yerine sahada ne yapılacağını anlatır.
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
      <h2 className="mes-section-title m-0">Makine Metrikleri vs Operatör Paneli</h2>
      <p className="mes-helper mt-2">
        Bu iki ekran farklı işleri yapar; karıştırmamak operatör hatasını önler.
      </p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-4 text-sm">
          <div className="font-semibold text-sky-950">Makine Metrikleri (IoT / PLC / Simülasyon)</div>
          <ul className="mt-2 mb-0 space-y-1 pl-4 text-sky-950">
            <li>Hat telemetrisi: çevrim, duruş, sıcaklık / RPM / titreşim göstergeleri</li>
            <li>OEE, lot ilerleme ve Live Stream simülasyonu burada merkezileştirilir</li>
            <li>Operatör barkod girmez; sensör / PLC / demo akış üretir</li>
            <li>SignalR ile canlı `oeeUpdated` yayınlanır</li>
          </ul>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-sm">
          <div className="font-semibold text-emerald-950">Operatör Paneli (Saha iş yönetimi)</div>
          <ul className="mt-2 mb-0 space-y-1 pl-4 text-emerald-950">
            <li>Barkod / malzeme / istasyon / kalite kaydı girişi</li>
            <li>Vardiya oturumu ve HMI dokunmatik akış</li>
            <li>Liste ve kalite grafiği bu kayıtlardan hesaplanır</li>
            <li>Simülasyon düğmesi burada değildir — Makine Metrikleri’ndedir</li>
          </ul>
        </div>
      </div>
    </section>

    <section className="mes-surface p-5">
      <h2 className="mes-section-title m-0">OEE nasıl hesaplanır?</h2>
      <p className="mes-helper mt-2">
        <strong>OEE = Kullanılabilirlik × Performans × Kalite</strong>. Kullanılabilirlik duruşlardan,
        performans ideal çevrim süresine göre hızdan, kalite ise iyi ürün / toplam üründen gelir.
        Gösterge kartlarının altındaki “Anlık Durum Analizi” hangi bileşenin baskın olduğunu Türkçe açıklar.
      </p>
      <ul className="mt-3 space-y-2 text-sm text-[color:var(--color-ink)]">
        <li><strong>Manuel giriş:</strong> Operatör Paneli formundan ürün / malzeme / istasyon / kalite.</li>
        <li><strong>API:</strong> Tüm kayıtlar `MiniMesApi` üzerinden SQL Server’a yazılır.</li>
        <li><strong>Simülasyon:</strong> Makine Metrikleri’nde Live Stream açıksa üretim + alarm akışı periyodik üretilir; backend OEE simülasyonu metrikleri besler.</li>
        <li><strong>Canlı yayın:</strong> Alarm ve OEE olayları SignalR (`/hubs/mes`) ile tarayıcıya düşer.</li>
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link to="/sistem" className="mes-btn-primary">
          <Radio size={16} />
          Simülasyon & Sistem Akışı
        </Link>
      </div>
    </section>

    <section className="mes-surface p-5">
      <h2 className="mes-section-title m-0">Operatör olarak neler yapabilirim?</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-[color:var(--color-line)] bg-emerald-50/50 p-4 text-sm">
          <div className="font-semibold text-emerald-900">Genelde yapabilirsiniz</div>
          <ul className="mt-2 mb-0 space-y-1 pl-4 text-emerald-950">
            <li>Üretim kaydı eklemek</li>
            <li>Alarm açmak</li>
            <li>OEE / metrikleri izlemek</li>
            <li>Andon ekranını açmak</li>
          </ul>
        </div>
        <div className="rounded-xl border border-[color:var(--color-line)] bg-amber-50/50 p-4 text-sm">
          <div className="font-semibold text-amber-950">Admin / yetki gerekir</div>
          <ul className="mt-2 mb-0 space-y-1 pl-4 text-amber-950">
            <li>Kalite OK↔NOK değiştirmek</li>
            <li>İş emri ilerletmek</li>
            <li>Alarm onaylamak / çözmek</li>
            <li>Kullanıcı ve rol yönetmek</li>
          </ul>
        </div>
      </div>
    </section>
  </div>
);

export default OperatorGuidePage;
