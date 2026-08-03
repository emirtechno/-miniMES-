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
            Tamamen otomatik, sensör odaklı mimari: Vardiya Başlat → Live Stream → OEE / Lot / Andon.
            Manuel barkod formu ve silinen kayıt çöp kutusu kaldırılmıştır.
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
          <strong>Tarayıcı (React + Vite)</strong> — Operatör vardiyası Live Stream’i tetikler; paneller telemetri durumunu okur.
        </li>
        <li>
          <strong>MiniMesApi (.NET)</strong> — JWT, EF Core, OEE hesabı, SignalR hub (`/hubs/mes`). Üretim POST’u append-only telemetri alımıdır.
        </li>
        <li>
          <strong>SQL Server</strong> — Değiştirilemez üretim telemetrisi, alarm, makine metrikleri, iş emri / lot.
        </li>
        <li>
          <strong>SignalR</strong> — `alarmCreated/Updated` ve `oeeUpdated` olaylarını Andon ve panellere yayınlar.
        </li>
      </ol>
    </section>

    <section className="grid gap-4 md:grid-cols-2">
      <article className="mes-surface p-5">
        <h2 className="mes-section-title m-0 flex items-center gap-2">
          <Radio size={18} />
          Live Stream ne yapar?
        </h2>
        <p className="mes-helper mt-2">
          Operatör “Vardiya Başlat” dediğinde istemci tarafı Live Stream, seçili istasyon için sensör benzeri
          OK/NOK olayları üretir; yüksek titreşim / ısınma / duruş / NOK spike Andon alarmı tetikler.
          Vardiya bitince veya duruş/setup’ta akış durur.
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          <li>Backend `OeeSimulation` (dev) makine metrikleri + OEE yazar.</li>
          <li>Lot progress, istasyon OK sayaçlarından senkronize edilir.</li>
          <li>Telemetri kayıtları silinmez (çöp kutusu yok).</li>
        </ul>
      </article>

      <article className="mes-surface p-5">
        <h2 className="mes-section-title m-0 flex items-center gap-2">
          <Database size={18} />
          Veri nereden gelir?
        </h2>
        <ul className="mt-3 space-y-2 text-sm">
          <li><strong>Üretim telemetrisi:</strong> Live Stream (vardiya) → `POST /Uretim`</li>
          <li><strong>Makine metrikleri / OEE:</strong> backend OEE simülasyonu + SignalR</li>
          <li><strong>Alarm / Andon:</strong> Live Stream anomali + kalite / HMI duruş</li>
          <li><strong>Lot:</strong> BatchController OK sayaç senkronu</li>
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
{`[Vardiya Başlat] --> [Live Stream Engine]
        |                     |
        |                     +--> POST /Uretim (OK/NOK) --> Lot progress
        |                     +--> Anomali --> POST /Alarm --> Andon (SignalR)
        v
[Makine Metrikleri / İstasyonlar / Fabrika]
        ^
        |
[OeeSimulationService] --> MachineMetrics + oeeUpdated (SignalR)
[Vardiya Bitir / Duruş / Setup] --> Live Stream PAUSE`}
      </pre>
    </section>

    <div className="flex flex-wrap gap-2">
      <Link to="/kilavuz" className="mes-btn-secondary">Kullanım Kılavuzuna Dön</Link>
      <Link to="/operator" className="mes-btn-primary">Operatör Paneli · Vardiya</Link>
      <Link to="/makine-metrikleri" className="mes-btn-secondary">Makine Metrikleri</Link>
    </div>
  </div>
);

export default SystemFlowPage;
