import { Database, Network, Radio, Server, Workflow } from 'lucide-react';
import { Link } from 'react-router-dom';

const SystemFlowPage = () => (
  <div className="mx-auto flex max-w-4xl flex-col gap-5">
    <section className="mes-surface p-6">
      <div className="flex items-start gap-3">
        <Workflow className="mt-1 text-[color:var(--color-info)]" size={24} />
        <div>
          <h1 className="font-display m-0 text-3xl font-semibold tracking-wide">Simülasyon ve Sistem Akışı</h1>
          <p className="mes-helper mt-2 mb-0">
            Verinin nereden geldiğini netleştirmek için: hangisi gerçek operatör girişi, hangisi demo simülasyonu, hangisi canlı yayın.
          </p>
        </div>
      </div>
    </section>

    <section className="mes-surface p-5">
      <h2 className="mes-section-title m-0 flex items-center gap-2">
        <Server size={18} />
        Mimari özet
      </h2>
      <ol className="mt-4 space-y-3 text-sm leading-relaxed text-[color:var(--color-ink)]">
        <li>
          <strong>Tarayıcı (React + Vite)</strong> — formlar, paneller, Andon. API çağrıları `/api` üzerinden gider; geliştirmede Vite proxy ASP.NET’e iletir.
        </li>
        <li>
          <strong>MiniMesApi (.NET)</strong> — kimlik (JWT), iş kuralları, EF Core migration’ları, OEE hesabı, SignalR hub (`/hubs/mes`).
        </li>
        <li>
          <strong>SQL Server</strong> — üretim, alarm, metrik, iş emri, Identity kullanıcıları. Migration’lar şemanın tek kaynağıdır.
        </li>
        <li>
          <strong>SignalR</strong> — `alarmCreated/Updated/Deleted` ve `oeeUpdated` olaylarını bağlı istemcilere yayınlar. Üst bardaki “Canlı” göstergesi bu bağlantıyı yansıtır.
        </li>
      </ol>
    </section>

    <section className="grid gap-4 md:grid-cols-2">
      <article className="mes-surface p-5">
        <h2 className="mes-section-title m-0 flex items-center gap-2">
          <Radio size={18} />
          OEE simülasyonu ne yapar?
        </h2>
        <p className="mes-helper mt-2">
          Geliştirme ortamında `OeeSimulation:Enabled=true` ise arka plan servisi periyodik olarak her katalog istasyonu için
          kullanılabilirlik / performans / kalite değerleri üretir, veritabanına yazar ve SignalR ile yayınlar.
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          <li>Gerçek PLC / SCADA yerine <em>demo telemetrisi</em>dir.</li>
          <li>Vardiya ve duruş nedeni kataloglarından seçilir.</li>
          <li>Makine Metrikleri’ndeki “Simülasyonu Çalıştır / Pause Live Stream” istemci tarafı üretim kaydı + NOK alarmı üretir; backend OEE simülasyonundan ayrıdır ama aynı canlı durumları besler.</li>
        </ul>
      </article>

      <article className="mes-surface p-5">
        <h2 className="mes-section-title m-0 flex items-center gap-2">
          <Database size={18} />
          Manuel veri nerede?
        </h2>
        <p className="mes-helper mt-2">
          Operatörün girdiği üretim kayıtları, iş emirleri, alarmlar ve (yetkiliyse) makine metrik formları her zaman API + veritabanı yolunu izler.
          Simülasyon kapalı olsa bile bu akış çalışır.
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          <li><strong>Üretim kaydı:</strong> Operatör Paneli formu</li>
          <li><strong>Alarm:</strong> Kalite ekranı</li>
          <li><strong>Metrik / Live Stream:</strong> Makine Metrikleri</li>
          <li><strong>Fabrika özeti:</strong> Fabrika Genel Bakış</li>
        </ul>
      </article>
    </section>

    <section className="mes-surface overflow-hidden p-0">
      <div className="border-b border-[color:var(--color-line)] bg-slate-50 px-5 py-3">
        <h2 className="mes-section-title m-0 flex items-center gap-2">
          <Network size={18} />
          Veri akış diyagramı
        </h2>
      </div>
      <pre className="m-0 overflow-x-auto bg-slate-950 p-5 font-mono text-xs leading-6 text-slate-100">
{`[Operatör UI] --REST/JWT--> [MiniMesApi] --EF Core--> [SQL Server]
      ^                           |
      |                           +--OeeSimulationService (dev)--+
      |                                                          |
      +------------- SignalR /hubs/mes <-------------------------+
           (oeeUpdated, alarmCreated/Updated/Deleted)
[Makine Metrikleri Live Stream] --> üretim OK/NOK + lot progress + alarm`}
      </pre>
    </section>

    <div className="flex flex-wrap gap-2">
      <Link to="/kilavuz" className="mes-btn-secondary">Kullanım Kılavuzuna Dön</Link>
      <Link to="/makine-metrikleri" className="mes-btn-primary">Makine Metriklerine Git</Link>
    </div>
  </div>
);

export default SystemFlowPage;
