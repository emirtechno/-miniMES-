import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Database,
  Factory,
  HardHat,
  HelpCircle,
  Network,
  Radio,
  Server,
  Shield,
  Users,
  Workflow,
} from 'lucide-react';
import { Link } from 'react-router-dom';

const glossary = [
  {
    term: 'OEE',
    meaning:
      'Overall Equipment Effectiveness — makinenin ne kadar verimli çalıştığını gösteren yüzde. Kabaca: Kullanılabilirlik × Performans × Kalite. Yüksek = iyi.',
  },
  {
    term: 'Andon',
    meaning:
      'Fabrika salonu / TV panosu. İstasyonların anlık durumunu (çalışıyor, durdu, alarm) büyük ekranda gösterir.',
  },
  {
    term: 'Duruş',
    meaning:
      'Hat bilinçli veya zorunlu olarak üretmiyor (mola, arıza, malzeme yok, setup…). Operatör “Duruş / Mola Bildir” ile kaydeder.',
  },
  {
    term: 'Oturum (ShiftSession)',
    meaning:
      'Operatörün “Vardiya Başlat” ile açtığı kişisel üretim oturumu. Operatör panelindeki sayaçlar burada sıfırdan başlar.',
  },
  {
    term: 'Katalog vardiya',
    meaning:
      'Saat dilimi A/B/C (ör. 06:00–14:00) toplamı. Andon / Fabrika / İstasyonlar buradan bakar. Operatör oturumu bunu sıfırlamaz.',
  },
  {
    term: 'Alarm',
    meaning:
      'Sistemin “dikkat!” uyarısı. Onayla = görüldü; Çöz = sorun kapandı. Kayıt silinmez. Engelleyici alarm üretimi duraklatır.',
  },
  {
    term: 'Scrap / Fire / NOK',
    meaning:
      'Bozuk / hatalı ürün. Gerçekleşen (Actual) − Sağlam (Good). Operatör “Fire / Hata Girişi” ile de yazabilir.',
  },
  {
    term: 'MachineMetrics (SSOT)',
    meaning:
      'Tek doğruluk kaynağı: her “tick” (anlık telemetri satırı) buraya yazılır. Ekranlar bu tablodan okur; tarayıcıda ayrı üretim sayacı tutulmaz.',
  },
  {
    term: 'StationRuntime',
    meaning:
      'İstasyonun anlık modu: Running (üretiyor), Paused (durakladı), Down (arıza/acil). Simülasyon yalnızca Running iken üretim tick’i yazar.',
  },
];

const morningStory = [
  {
    step: '1',
    title: 'Giriş yaparsın',
    body: 'Kullanıcı adı + parola → JWT oturumu. Rolün (Admin / Operator / Auditor) yetkileri belirler; üst bardaki kişilik sadece hangi menülerin görüneceğini değiştirir.',
  },
  {
    step: '2',
    title: 'Simülasyon açık mı?',
    body: 'Demo/lab’de üst barda “Sim Açık” olmalı; kapalıysa yeni tick yazılmaz, Andon “SİM KAPALI” gösterir. Yetki: simulation.control.',
  },
  {
    step: '3',
    title: 'Operatör vardiya başlatır',
    body: 'Operatör Paneli → istasyon seç → Vardiya Başlat. Backend’de ShiftSession açılır; StationRuntime genelde Running olur. Oturum sayaçları sıfırdan başlar.',
  },
  {
    step: '4',
    title: 'Üretim tick’leri akar',
    body: 'Backend (OeeSimulationService veya gerçek PLC) her birkaç saniyede bir satır üretir → IMetricIngestService → MachineMetrics. İyi ürün, fire, sıcaklık/RPM, OEE buradan gelir.',
  },
  {
    step: '5',
    title: 'Panolar güncellenir',
    body: 'Operatör paneli oturum KPI’sını gösterir. Andon / Fabrika / İstasyonlar katalog vardiya toplamını gösterir. SignalR ile anlık yenilenir (oeeUpdated, telemetryTick, shiftUpdated, alarm*).',
  },
  {
    step: '6',
    title: 'Duruş, fire veya alarm olabilir',
    body: 'Operatör duruş/fire/setup/acil basabilir. Anomali veya manuel alarm engelleyiciyse hat Paused/Down’a düşer; üretim tick’i durur.',
  },
  {
    step: '7',
    title: 'Alarm kapanır → üretime dönüş',
    body: 'Onayla (gördüm) → sorunu gider → Çöz. Mola/setup yoksa sistem otomatik Running’e dönebilir; aksi halde Operatör Panelinden Üretime Dön.',
  },
  {
    step: '8',
    title: 'Vardiya biter / gerekirse sıfırla',
    body: 'Vardiya Bitir → oturum kapanır. Demo temizliği için Yönetim’de “SIFIRLA” ile shop-floor verisi silinir; kullanıcılar ve ürün kataloğu kalır.',
  },
];

const roles = [
  {
    icon: HardHat,
    title: 'Operatör',
    who: 'Rol: Operator (+ Admin kişiliği Operatör seçebilir)',
    items: [
      'Ana ekran: Operatör Paneli — vardiya, duruş, fire, setup, acil.',
      'Menüde: İstasyonlar, Makine Metrikleri, Kullanım Kılavuzu.',
      'Andon / Fabrika / Kalite / Yönetim / Sistem Akışı menüde yok (Operatör kişiliği).',
    ],
  },
  {
    icon: Factory,
    title: 'Yönetici',
    who: 'Rol: Admin · kişilik: Yönetici',
    items: [
      'Fabrika Genel Bakış, Andon (çift OEE), Kalite, Sistem Akışı, Yönetim.',
      'Alarm Onayla / Çöz (alarms.manage), iş emri işlemleri (workorders.manage).',
      'Simülasyon aç/kapa ve shop-floor sıfırlama (simulation.control).',
    ],
  },
  {
    icon: Shield,
    title: 'IT Yönetici',
    who: 'Rol: Admin · kişilik: IT Yönetici',
    items: [
      'Aynı geniş menü; varsayılan giriş Yönetim ekranına düşer.',
      'Kullanıcı / rol yönetimi (users.manage), test/manuel alarm, sıfırlama.',
    ],
  },
  {
    icon: Users,
    title: 'Auditor',
    who: 'Rol: Auditor (okuma ağırlıklı)',
    items: [
      'İzleme / denetim için; yazma butonları permission setine bağlıdır.',
      'Kişilik seçenekleri JWT rollerine göre açılır.',
    ],
  },
];

const SystemFlowPage = () => (
  <div className="mx-auto flex max-w-4xl flex-col gap-5">
    <section className="mes-surface p-6">
      <div className="flex items-start gap-3">
        <Workflow className="mt-1 text-[color:var(--color-info)]" size={24} />
        <div>
          <h1 className="font-display m-0 text-3xl font-semibold tracking-wide">Sistem Akışı</h1>
          <p className="mes-helper mt-2 mb-0 max-w-2xl">
            Bu sayfa Vestel Mini MES’te verinin ve işin nasıl aktığını anlatır — MES bilmeyen biri için.
            Kısa özet: <strong>operatör vardiya açar</strong>, backend <strong>tick yazar</strong>,
            panolar <strong>okur</strong>; tarayıcı kendi başına üretim sayısı üretmez.
            Günlük “nasıl kullanılır?” için{' '}
            <Link to="/kilavuz" className="underline">
              Kullanım Kılavuzu
            </Link>
            ’na bakın.
          </p>
        </div>
      </div>
    </section>

    <section className="mes-surface p-5">
      <h2 className="mes-section-title m-0 flex items-center gap-2">
        <Factory size={18} />
        Sabah fabrikaya geldin — uçtan uca hikâye
      </h2>
      <ol className="mt-4 space-y-3">
        {morningStory.map(({ step, title, body }) => (
          <li
            key={step}
            className="flex gap-3 rounded-xl border border-[color:var(--color-line)] bg-slate-50/80 p-3"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-sm font-semibold text-white">
              {step}
            </span>
            <div className="min-w-0">
              <h3 className="m-0 text-sm font-semibold text-[color:var(--color-ink)]">{title}</h3>
              <p className="mes-helper mb-0 mt-1">{body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>

    <section className="mes-surface overflow-hidden p-0">
      <div className="border-b border-[color:var(--color-line)] bg-slate-50 px-5 py-3">
        <h2 className="mes-section-title m-0 flex items-center gap-2">
          <Network size={18} />
          Görsel akış (basitleştirilmiş)
        </h2>
      </div>
      <div className="space-y-2 bg-slate-950 p-5 font-mono text-xs leading-6 text-slate-100">
        <p className="m-0 text-slate-400">Giriş (JWT) → Operatör: Vardiya Başlat (ShiftSession)</p>
        <p className="m-0 flex flex-wrap items-center gap-2 text-emerald-300">
          StationRuntime: Running <ArrowRight size={12} className="inline opacity-70" /> Sim/PLC tick
        </p>
        <p className="m-0 text-sky-300">→ IMetricIngestService → MachineMetrics (SSOT)</p>
        <p className="m-0 pl-4 text-slate-300">
          + ProductionProgressSync (WO) · + TelemetryAnomaly → Alarm + pause
        </p>
        <p className="m-0 pl-4 text-slate-300">
          + SignalR: oeeUpdated · telemetryTick · shiftUpdated · alarmCreated/Updated
        </p>
        <p className="m-0 mt-2 text-amber-200">Okuyanlar:</p>
        <p className="m-0 pl-4 text-slate-200">
          Operatör paneli ← GET /ShiftSession/active (oturum OEE / OK / NOK)
        </p>
        <p className="m-0 pl-4 text-slate-200">
          Andon / Fabrika / İstasyonlar ← GET /Oee/shift-current (katalog OEE)
        </p>
        <p className="m-0 pl-4 text-slate-200">Trend / tablo ← GET /MachineMetrics</p>
        <p className="m-0 mt-2 text-rose-300">
          Alarm Çöz → engel kalkarsa otomatik Running olabilir; mola/setup’ta Üretime Dön gerekir
        </p>
      </div>
    </section>

    <section className="mes-surface p-5">
      <h2 className="mes-section-title m-0 flex items-center gap-2">
        <HelpCircle size={18} />
        Ne demek? (sözlük)
      </h2>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        {glossary.map(({ term, meaning }) => (
          <div key={term} className="rounded-xl border border-[color:var(--color-line)] bg-slate-50/80 p-3">
            <dt className="text-sm font-semibold text-[color:var(--color-ink)]">{term}</dt>
            <dd className="mes-helper mt-1 mb-0">{meaning}</dd>
          </div>
        ))}
      </dl>
    </section>

    <section className="mes-surface p-5">
      <h2 className="mes-section-title m-0 flex items-center gap-2">
        <Users size={18} />
        Kim ne yapar?
      </h2>
      <p className="mes-helper mt-2">
        <strong>Rol</strong> (JWT) yetkiyi verir; <strong>kişilik</strong> menüyü süzer. Sistem Akışı
        sayfası Yönetici / IT Yönetici kişiliğinde görünür.
      </p>
      <div className="mt-4 grid gap-4">
        {roles.map(({ icon: Icon, title, who, items }) => (
          <article
            key={title}
            className="rounded-xl border border-[color:var(--color-line)] bg-slate-50/60 p-4"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                <Icon size={18} />
              </span>
              <div className="min-w-0">
                <h3 className="mes-section-title m-0">{title}</h3>
                <p className="mes-helper mt-1 mb-2 text-xs">{who}</p>
                <ul className="m-0 space-y-1.5 pl-4 text-sm">
                  {items.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>

    <section className="mes-surface p-5">
      <h2 className="mes-section-title m-0 flex items-center gap-2">
        <Radio size={18} />
        İki OEE — neden farklı görünebilir?
      </h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-[color:var(--color-line)] bg-slate-50/80 p-4">
          <h3 className="m-0 text-sm font-semibold">Oturum OEE</h3>
          <p className="mes-helper mt-2 mb-0">
            “Vardiya Başlat”tan beri bu operatör oturumu. Kaynak:{' '}
            <code className="text-xs">GET /ShiftSession/active</code>. Operatör panelinde ve Andon’un
            büyük gauge’ında (oturum varsa) görünür.
          </p>
        </div>
        <div className="rounded-xl border border-[color:var(--color-line)] bg-slate-50/80 p-4">
          <h3 className="m-0 text-sm font-semibold">Katalog OEE</h3>
          <p className="mes-helper mt-2 mb-0">
            Saat dilimi A/B/C penceresinin toplamı (tüm birikim). Kaynak:{' '}
            <code className="text-xs">GET /Oee/shift-current</code>. Fabrika, İstasyonlar, Andon alt satırı.
            Yeni oturum açmak bunu sıfırlamaz.
          </p>
        </div>
      </div>
      <p className="mes-helper mb-0 mt-3">
        Andon üst özetinde her ikisi de vardır: Ortalama OEE (Oturum) ve Ortalama OEE (Katalog).
      </p>
    </section>

    <section className="mes-surface p-5">
      <h2 className="mes-section-title m-0 flex items-center gap-2">
        <AlertTriangle size={18} />
        Alarm açılınca ne olur?
      </h2>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
        <li>
          Alarm oluşur (anomali, operatör Acil, veya Yönetim’den manuel/test) → SignalR{' '}
          <code className="text-xs">alarmCreated</code>.
        </li>
        <li>
          Engelleyici ise <code className="text-xs">StationRuntime</code> → Paused veya Down; üretim
          tick’i yazılmaz (downtime tick yazılabilir).
        </li>
        <li>
          Andon / Kalite’de listede görünür. <strong>Onayla</strong> = “gördüm” (listede kalır).
        </li>
        <li>
          Sorun giderilince <strong>Çöz</strong> → kayıt kapanır (silinmez); açık engelleyici kalmadıysa
          ve istasyon mola/setup’ta değilse sistem Running’e dönebilir.
        </li>
        <li>
          Hâlâ duraklıysa Operatör Panelinden <strong>Üretime Dön</strong>. Sadece Onayla üretimi
          başlatmaz.
        </li>
      </ol>
      <p className="mes-helper mb-0 mt-3">
        <strong>Duruş ≠ Alarm:</strong> Duruş operatörün “üretmiyoruz” kaydı; alarm sistem/manuel
        uyarıdır. İkisi de kartı duraklatabilir.
      </p>
    </section>

    <section className="mes-surface p-5">
      <h2 className="mes-section-title m-0 flex items-center gap-2">
        <Database size={18} />
        Fire, kalite ve sıfırlama
      </h2>
      <ul className="mt-3 space-y-2 text-sm">
        <li>
          <strong>Fire:</strong> Operatör “Fire / Hata Girişi” → ScrapLog + NOK tick. Telemetride fire =
          Actual − Good.
        </li>
        <li>
          <strong>Kalite Raporları:</strong> iş emirleri, alarm listesi, fire içeren tick’ler.
        </li>
        <li>
          <strong>Shop-floor sıfırlama (Yönetim):</strong> onay kutusuna <code className="text-xs">SIFIRLA</code>{' '}
          → metrikler, scrap, alarmlar, vardiya oturumları, duruş olayları silinir; WO sayaçları 0’lanır;
          StationRuntime’lar Paused’a çekilir. Kullanıcılar ve ürün/istasyon kataloğu kalır.
        </li>
      </ul>
    </section>

    <section className="mes-surface p-5">
      <h2 className="mes-section-title m-0 flex items-center gap-2">
        <Server size={18} />
        Teknik ek (formüller ve kapılar)
      </h2>
      <p className="mes-helper mt-2">
        MachineMetrics, ScrapLogs, ShiftSession ve StationRuntime backend doğruluk kaynağıdır.
        Frontend yalnızca okur ve operatör eylemlerini API üzerinden yazar.
      </p>
      <ul className="mt-3 space-y-2 text-sm font-mono leading-relaxed">
        <li>Actual = Σ ActualProductionCount</li>
        <li>Good (OK) = Σ GoodProductionCount</li>
        <li>NOK / Fire = Actual − Good</li>
        <li>Yield = Good / Actual × 100</li>
        <li>OEE = Availability × Performance × Quality (tick / pencere toplamı)</li>
        <li>WO ilerleme = ProductionProgressSync(delta Good)</li>
      </ul>
      <ul className="mt-4 space-y-2 text-sm">
        <li>
          Yazım kapısı: <code className="text-xs">IMetricIngestService</code> (sim + PLC/API).
        </li>
        <li>
          Running değilken sim üretim tick’i yazmaz; Paused/Down downtime tick yazabilir.
        </li>
        <li>
          Katalog ShiftCode tick zamanından hesaplanır; operatörün seçtiği A/B/C oturum kodu katalog
          penceresini ezmez.
        </li>
      </ul>
    </section>

    <div className="flex flex-wrap gap-2">
      <Link to="/kilavuz" className="mes-btn-primary">
        <BookOpen size={16} />
        Kullanım Kılavuzu
      </Link>
      <Link to="/operator" className="mes-btn-secondary">
        Operatör · Vardiya
      </Link>
      <Link to="/andon" className="mes-btn-secondary">
        Andon
      </Link>
      <Link to="/makine-metrikleri" className="mes-btn-secondary">
        Makine Metrikleri
      </Link>
    </div>
  </div>
);

export default SystemFlowPage;
