import {
  Activity,
  AlertTriangle,
  BookOpen,
  Building2,
  Cpu,
  Factory,
  Gauge,
  HardHat,
  HelpCircle,
  LogIn,
  Monitor,
  Radio,
  Settings,
  Shield,
  Wrench,
} from 'lucide-react';
import { Link } from 'react-router-dom';

const glossary = [
  {
    term: 'OEE',
    meaning:
      'Overall Equipment Effectiveness — makinenin ne kadar verimli çalıştığını gösteren yüzde. Kabaca: kullanılabilirlik × performans × kalite. Yüksek = iyi.',
  },
  {
    term: 'Andon',
    meaning:
      'Fabrika salonu / TV panosu. İstasyonların anlık durumunu (çalışıyor, durdu, alarm) uzaktan büyük ekranda gösterir.',
  },
  {
    term: 'Duruş',
    meaning:
      'Hat bilinçli veya zorunlu olarak üretmiyor (mola, arıza, malzeme yok, setup…). Operatör panelinden “Duruş / Mola Bildir” ile kaydedilir.',
  },
  {
    term: 'Alarm',
    meaning:
      'Sistemin “dikkat!” uyarısı (sıcaklık anomalisi, acil arıza vb.). Onayla = görüldü; Çöz = sorun kapandı. Kayıt silinmez.',
  },
  {
    term: 'Scrap / Fire / NOK',
    meaning:
      'Bozuk / hatalı ürün. Gerçekleşen (Actual) − Sağlam (Good). Operatör “Fire / Hata Girişi” ile de yazabilir.',
  },
  {
    term: 'Oturum (ShiftSession)',
    meaning:
      'Bir operatörün “Vardiya Başlat” ile açtığı kişisel üretim oturumu. KPI’lar burada sıfırdan başlar.',
  },
  {
    term: 'Katalog vardiya',
    meaning:
      'Saat dilimi A/B/C (ör. 06:00–14:00) toplamı. Andon / Fabrika / İstasyonlar buradan bakar. Operatör oturumu bunu sıfırlamaz.',
  },
  {
    term: 'Fabrika simülasyonu',
    meaning:
      'Demo/lab için backend’in otomatik telemetri (tick) üretmesi. Üst bardaki “Sim Açık/Kapalı” ile yönetilir; durum veritabanında kalıcıdır.',
  },
];

const screenSections = [
  {
    icon: Building2,
    title: 'Fabrika Genel Bakış',
    path: '/fabrika',
    who: 'Yönetici / IT',
    body: [
      'Tüm hatların katalog vardiya özeti: OEE, Σ Sağlam (OK), Σ Fire (NOK).',
      'Operatör “Vardiya Başlat” buradaki toplamları sıfırlamaz — Andon ile aynı katalog penceresidir.',
      'İstasyon kartlarında OEE rengi kabaca: yüksek yeşil, orta sarı, düşük kırmızı.',
    ],
  },
  {
    icon: HardHat,
    title: 'Operatör Paneli',
    path: '/operator',
    who: 'Operatör (+ Yönetici)',
    body: [
      'Günlük saha ekranı: istasyon seç, vardiya aç/kapat, duruş, fire, setup, acil durum.',
      'Sayaçlar “Oturum Σ Sağlam / Fire / Verim” — sadece bu oturuma aittir.',
      '“Fabrika simülasyonu” kutusu burada da vardır (yetkiniz varsa Aç/Kapat).',
    ],
  },
  {
    icon: Wrench,
    title: 'İstasyonlar',
    path: '/istasyonlar',
    who: 'Herkes (persona’ya göre)',
    body: [
      'Her istasyon kartında Katalog OK / NOK / OEE ve sıcaklık-RPM gibi canlı özetler.',
      'Detayı Aç → Makine Metrikleri ekranına gider.',
      'Katalog = saat dilimi toplamı; oturum KPI’sı Operatör Panelindedir.',
    ],
  },
  {
    icon: Shield,
    title: 'Kalite Raporları',
    path: '/kalite',
    who: 'Yönetici / IT',
    body: [
      'İş emirleri (WO), lot/izlenebilirlik, alarm listesi, fire içeren telemetri satırları.',
      'Fire = Actual − Good > 0 olan MachineMetrics tick’leri (barkod tek tek sayılmaz).',
      'Alarmlarda Onayla / Çöz-Kapat (yetki: alarms.manage).',
    ],
  },
  {
    icon: Gauge,
    title: 'Makine Metrikleri',
    path: '/makine-metrikleri',
    who: 'Herkes (persona’ya göre)',
    body: [
      'Telemetri merkezi: trend grafiği, tick tablosu, Katalog OEE / OK / NOK.',
      'Vardiya durumu panellerde görünür; tick yazımı backend fabrika telemetrisindedir.',
      'Operatör panelinden veya buradan ilgili istasyona odaklanabilirsiniz.',
    ],
  },
  {
    icon: Monitor,
    title: 'Andon Ekranı',
    path: '/andon',
    who: 'Yönetici / IT (Operatör kişiliğinde kapalı)',
    body: [
      'Canlı saha panosu: istasyon durumu, çift OEE (Oturum + Katalog), açık alarmlar.',
      'Gauge renkleri: ≥%85 yeşil · %45–85 sarı · <%45 kırmızı.',
      'Alarm: Onayla (görüldü) → Çöz (kapat). Engelleyici alarm sonrası üretim için Çöz + Üretime Dön.',
    ],
  },
  {
    icon: Settings,
    title: 'Yönetim',
    path: '/yonetim',
    who: 'Yönetici / IT (yetkiye bağlı)',
    body: [
      'Kullanıcılar ve roller (Admin / Operator / Auditor) — users.manage.',
      'Manuel / test alarm oluşturma — alarms.write.',
      'Shop-floor sıfırlama: onay kutusuna SIFIRLA yazıp “Veriyi sıfırla” — simulation.control.',
    ],
  },
  {
    icon: Radio,
    title: 'Sistem Akışı',
    path: '/sistem',
    who: 'Yönetici / IT',
    body: [
      'Teknik özet: verinin nereden geldiği (MachineMetrics SSOT), formüller, SignalR.',
      'Günlük operasyon için şart değil; “neden rakamlar böyle?” diye merak edenler için.',
    ],
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
            Vestel Mini MES, fabrikadaki üretimi takip eden küçük bir MES uygulamasıdır.
            Basitçe düşünün: bir yandan <strong>fabrika skor panosu</strong> (Andon / Fabrika),
            diğer yandan operatörün kullandığı <strong>tablet / HMI</strong> (Operatör Paneli).
            Üretim sayıları barkod tek tek okutularak değil; makine telemetrisi (MachineMetrics) ve
            operatör fire/duruş kayıtlarıyla birikir.
          </p>
        </div>
      </div>
    </section>

    <section className="mes-surface p-5">
      <h2 className="mes-section-title m-0 flex items-center gap-2">
        <HelpCircle size={18} />
        Ne demek? (kısa sözlük)
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
        <Factory size={18} />
        Kim neyi görür?
      </h2>
      <p className="mes-helper mt-2">
        Girişte size verilen <strong>roller</strong> (Admin, Operator, Auditor) yetkileri belirler.
        Üst bardaki <strong>kişilik (persona)</strong> sadece hangi menülerin görüneceğini değiştirir;
        JWT rolünüzü değiştirmez.
      </p>
      <ul className="mt-3 space-y-2 text-sm">
        <li>
          <strong>Operatör</strong> — Ana ekran: Operatör Paneli. Ayrıca İstasyonlar, Makine Metrikleri, bu kılavuz.
          Andon / Fabrika / Kalite / Yönetim menüde yok.
        </li>
        <li>
          <strong>Yönetici</strong> — Fabrika Genel Bakış’tan başlar; Andon, Kalite, Yönetim ve Sistem Akışı açık.
        </li>
        <li>
          <strong>IT Yönetici</strong> — Aynı geniş menü; varsayılan giriş Yönetim ekranına düşer.
        </li>
      </ul>
      <p className="mes-helper mb-0 mt-3">
        Bazı butonlar ek yetki ister (ör. alarm çözme: <code className="text-xs">alarms.manage</code>,
        kullanıcı: <code className="text-xs">users.manage</code>, sim/sıfırlama:{' '}
        <code className="text-xs">simulation.control</code>).
      </p>
    </section>

    <section className="mes-surface p-5">
      <h2 className="mes-section-title m-0 flex items-center gap-2">
        <LogIn size={18} />
        Giriş yapmak
      </h2>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
        <li>Uygulamayı açın → Giriş ekranı (VESTEL MES).</li>
        <li>Size verilen <strong>kullanıcı adı</strong> ve <strong>parola</strong>yı yazın.</li>
        <li>
          <strong>Sisteme Giriş Yap</strong>’a basın.
          Admin → Fabrika; sadece Operator → Operatör Paneli.
        </li>
        <li>Çıkış için üst bardaki <strong>Çıkış</strong> düğmesi.</li>
      </ol>
      <p className="mes-helper mb-0 mt-3">
        “Giriş yapılamadı” veya ağ hatası görürseniz API (genelde <code className="text-xs">localhost:5000</code>)
        çalışıyor mu kontrol edin. Oturum süresi dolunca yeniden giriş gerekir.
      </p>
    </section>

    <section className="mes-surface p-5">
      <h2 className="mes-section-title m-0">Üst bar (her ekranda)</h2>
      <ul className="mt-3 space-y-2 text-sm">
        <li>
          <strong>Canlı / Yok</strong> — SignalR bağlantısı (alarm ve OEE anlık güncellemesi).
        </li>
        <li>
          <strong>Sim Açık / Kapalı</strong> — Fabrika simülasyonu. Yetkiniz yoksa sadece okunur.
          Kapalıyken Andon “SİM KAPALI” gösterir; yeni tick yazılmaz.
        </li>
        <li>
          <strong>Vardiya etiketi</strong> — Aktif oturum varsa vardiya adı + süre; yoksa “Kapalı”.
        </li>
        <li>
          <strong>Oto / Manuel + Yenile</strong> — Telemetri otomatik yenileme veya anlık çekme.
        </li>
      </ul>
    </section>

    <section className="mes-surface p-5">
      <h2 className="mes-section-title m-0 flex items-center gap-2">
        <HardHat size={18} />
        Operatör: vardiya ve saha akışı
      </h2>
      <h3 className="mt-4 text-sm font-semibold">Vardiya başlat → üret → bitir</h3>
      <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm">
        <li>
          <Link to="/operator" className="underline">Operatör Paneli</Link>’ne gidin; istasyonu seçin
          (vardiya açıkken istasyon kilitlenir).
        </li>
        <li>
          <strong>Vardiya Başlat</strong> → formu doldurun (operatör, vardiya A/B/C, istasyon).
        </li>
        <li>
          Simülasyon açıksa backend tick yazar; panoda Σ Sağlam / Fire / Verim artar.
          Açık engelleyici alarm varsa hat “durakladı” kalabilir — Andon’dan Çöz veya{' '}
          <strong>Üretime Dön</strong> deneyin.
        </li>
        <li>
          Gerektiğinde saha butonlarını kullanın (aşağıda).
        </li>
        <li>
          <strong>Vardiya Bitir</strong> → özet (süre, fire) gösterilir; oturum kapanır.
        </li>
      </ol>

      <h3 className="mt-4 text-sm font-semibold">Operatör Saha Butonları</h3>
      <ul className="mt-2 space-y-2 text-sm">
        <li>
          <strong>Operatör İşlemleri</strong> — PIN / keypad ile ikinci operatör.
        </li>
        <li>
          <strong>Duruş / Mola Bildir</strong> — Neden seçin (arıza, malzeme, mola…). Duraklayınca buton{' '}
          <strong>Üretime Dön</strong> / <strong>Simülasyonu sürdür</strong> olur.
        </li>
        <li>
          <strong>Fire / Hata Girişi</strong> — Bozuk adet girişi (ScrapLog + NOK tick).
        </li>
        <li>
          <strong>Model Değişimi / Setup</strong> — Setup başlat; bitince Setup Bitir / Üretime Dön.
        </li>
        <li>
          <strong>Acil / Arıza</strong> — Kritik duruş + alarm üretir; hat Andon’da DURDU / alarm gösterir.
        </li>
      </ul>
    </section>

    <section className="mes-surface p-5">
      <h2 className="mes-section-title m-0 flex items-center gap-2">
        <Monitor size={18} />
        Andon: canlı pano ve alarmlar
      </h2>
      <p className="mes-helper mt-2">
        Andon ayrı tam ekran panodur (menüden <strong>Andon Ekranı</strong>). Operatör kişiliğinde
        bu sayfa açılmaz; Yönetici / IT gerekir.
      </p>
      <ul className="mt-3 space-y-2 text-sm">
        <li>
          Üst özet: <strong>Ortalama OEE (Oturum)</strong>, açık alarm sayısı,{' '}
          <strong>Ortalama OEE (Katalog)</strong>.
        </li>
        <li>
          Büyük gauge: oturum varsa oturum OEE, yoksa katalog OEE. Alt satırda her zaman
          “Katalog %… · OK / NOK” görünür.
        </li>
        <li>
          Gauge renkleri: <strong>≥ %85 yeşil</strong>, <strong>%45–85 sarı</strong>,{' '}
          <strong>&lt; %45 kırmızı</strong>; veri yoksa idle.
        </li>
        <li>
          Durum rozetleri: ÇALIŞIYOR · DURAKLADI · DURDU · SİM KAPALI · BOŞTA · OTURUM / Oturum yok.
        </li>
        <li>
          <strong>Duruş ≠ Alarm:</strong> Duruş operatörün kaydettiği “üretmiyoruz” hali;
          alarm sistem/manuel uyarıdır. Açık alarm da kartı duraklatabilir.
        </li>
      </ul>

      <h3 className="mt-4 text-sm font-semibold">Alarm: Onayla ve Çöz</h3>
      <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm">
        <li>Andon altındaki <strong>Canlı Alarmlar</strong> listesine bakın (veya Kalite → Alarm paneli).</li>
        <li>
          <strong>Onayla</strong> — “Gördüm” kaydı; alarm listede kalır (status Onaylandı).
        </li>
        <li>
          <strong>Çöz</strong> — Sorun kapandı; onay sorusu çıkar; kayıt silinmez, canlı listeden düşer.
        </li>
        <li>
          Hat hâlâ durakladıysa Operatör Panelinden <strong>Üretime Dön</strong>.
        </li>
      </ol>
    </section>

    <section className="mes-surface p-5">
      <h2 className="mes-section-title m-0 flex items-center gap-2">
        <Activity size={18} />
        Kalite, fire ve iş emirleri
      </h2>
      <ul className="mt-3 space-y-2 text-sm">
        <li>
          <Link to="/kalite" className="underline">Kalite Raporları</Link>: iş emri tahtası, lot izlenebilirlik,
          plant Σ Gerçekleşen / Sağlam / Fire, alarm takibi, fire tick tablosu.
        </li>
        <li>
          Operatör fire’si Operatör Panelinden girilir; telemetri fire’si Actual − Good farkından gelir.
        </li>
        <li>
          İş emri ilerletme / örnek WO oluşturma için <code className="text-xs">workorders.manage</code> ve
          Yönetici kişiliği gerekir.
        </li>
      </ul>
    </section>

    <section className="mes-surface p-5">
      <h2 className="mes-section-title m-0 flex items-center gap-2">
        <Settings size={18} />
        Yönetim (admin)
      </h2>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
        <li>
          <Link to="/yonetim" className="underline">Yönetim</Link> → kullanıcı oluşturun, rol atayın
          (Admin / Operator / Auditor), aktif/pasif yapın.
        </li>
        <li>
          <strong>Test Alarmı Oluştur</strong> veya formla <strong>Manuel Alarm Ekle</strong>
          (başlık ≥3 karakter, istasyon, şiddet).
        </li>
        <li>
          <strong>Shop-floor verisini sıfırla</strong> (dikkat: geri alınamaz demo temizliği):
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Onay kutusuna tam olarak <code className="text-xs">SIFIRLA</code> yazın.</li>
            <li>
              <strong>Veriyi sıfırla</strong> → ikinci onay penceresi.
            </li>
            <li>
              Silinenler: metrikler, scrap, alarmlar, vardiya oturumları, duruş olayları;
              kullanıcılar ve ürün kataloğu kalır.
            </li>
            <li>Sonra Operatör Panelinden yeni <strong>Vardiya Başlat</strong>.</li>
          </ol>
        </li>
      </ol>
    </section>

    <section className="grid gap-4">
      <h2 className="mes-section-title m-0 px-1">Ekranlar (menü)</h2>
      {screenSections.map(({ icon: Icon, title, path, who, body }) => (
        <article key={path} className="mes-surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                <Icon size={18} />
              </span>
              <div className="min-w-0">
                <h3 className="mes-section-title m-0">{title}</h3>
                <p className="mes-helper mt-1 mb-2 text-xs">Kim: {who}</p>
                <ul className="m-0 space-y-1.5 pl-4 text-sm">
                  {body.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            </div>
            <Link to={path} className="mes-btn-secondary shrink-0">Ekrana Git</Link>
          </div>
        </article>
      ))}
    </section>

    <section className="mes-surface p-5">
      <h2 className="mes-section-title m-0 flex items-center gap-2">
        <AlertTriangle size={18} />
        Sık sorunlar
      </h2>
      <ul className="mt-3 space-y-3 text-sm">
        <li>
          <strong>Veriler gelmiyor / giriş olmuyor</strong> — Backend API ayakta mı?
          Üst barda “Yok” (SignalR) uzun süre kalıyorsa bağlantıyı kontrol edin. <strong>Yenile</strong> deneyin.
        </li>
        <li>
          <strong>Andon boş / SİM KAPALI</strong> — Fabrika simülasyonunu Açın (yetki gerekir).
          Sonra bir istasyonda Vardiya Başlatın; katalog OEE yine de vardiya penceresinden birikebilir.
        </li>
        <li>
          <strong>Hat durdu, üretim artmıyor</strong> — Açık alarmı Andon/Kalite’den <strong>Çöz</strong>,
          sonra Operatör Panelinden <strong>Üretime Dön</strong>. Sadece Onayla yetmez.
        </li>
        <li>
          <strong>Menüde Andon yok</strong> — Operatör kişiliğindesiniz. Üst bardan Yönetici / IT Yönetici’ye geçin
          (hesabınızda Admin rolü olmalı).
        </li>
        <li>
          <strong>Oturum OEE ile Katalog OEE farklı</strong> — Normal. Oturum = sizin Vardiya Başlat’tan beri;
          Katalog = A/B/C saat dilimi toplamı (tüm operatörler / birikim).
        </li>
        <li>
          <strong>Butonlar pasif / yetki yok</strong> — Rolünüz veya permission setiniz o işlemi açmıyor;
          Yönetim’den Admin’e sorun.
        </li>
      </ul>
    </section>

    <section className="mes-surface p-5">
      <h2 className="mes-section-title m-0 flex items-center gap-2">
        <Cpu size={18} />
        Tipik gün (kısa akış)
      </h2>
      <ol className="mt-3 space-y-2 text-sm">
        <li>1. Giriş yap → (gerekirse) Sim Açık olduğundan emin ol</li>
        <li>2. Operatör: Vardiya Başlat → üretim / duruş / fire</li>
        <li>3. Yönetici: Andon’da Oturum + Katalog OEE ve alarmları izle</li>
        <li>4. Alarm çıkarsa Onayla → sorunu gider → Çöz → Üretime Dön</li>
        <li>5. Vardiya Bitir → gerekirse Kalite / Makine Metrikleri’nden raporla</li>
      </ol>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link to="/sistem" className="mes-btn-primary">
          <Radio size={16} />
          Sistem Akışı (teknik)
        </Link>
        <Link to="/operator" className="mes-btn-secondary">Operatör Paneli</Link>
        <Link to="/andon" className="mes-btn-secondary">Andon</Link>
      </div>
    </section>
  </div>
);

export default OperatorGuidePage;
