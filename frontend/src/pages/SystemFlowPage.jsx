import { Database, Network, Radio, Server, Workflow } from 'lucide-react';
import { Link } from 'react-router-dom';

const SystemFlowPage = () => (
  <div className="mx-auto flex max-w-4xl flex-col gap-5">
    <section className="mes-surface p-6">
      <div className="flex items-start gap-3">
        <Workflow className="mt-1 text-[color:var(--color-info)]" size={24} />
        <div>
          <h1 className="font-display m-0 text-3xl font-semibold tracking-wide">Telemetri SSOT · Sistem Akışı</h1>
          <p className="mes-helper mt-2 mb-0">
            MachineMetrics (PLC/SCADA batch tick’leri) uygulamanın tek doğruluk kaynağıdır.
            1-by-1 barkod sayaçları KPI yollarından kaldırılmıştır.
          </p>
        </div>
      </div>
    </section>

    <section className="mes-surface p-5">
      <h2 className="mes-section-title m-0 flex items-center gap-2">
        <Server size={18} />
        Aggregation formülleri
      </h2>
      <ul className="mt-3 space-y-2 text-sm font-mono leading-relaxed">
        <li>Actual = Σ ActualProductionCount</li>
        <li>Good (OK) = Σ GoodProductionCount</li>
        <li>NOK / Fire = Actual − Good</li>
        <li>Yield = Good / Actual × 100</li>
        <li>OEE = Availability × Performance × Quality (son MachineMetric tick)</li>
        <li>Lot Produced = Clamp(Σ Good[station], 0, Target)</li>
      </ul>
    </section>

    <section className="grid gap-4 md:grid-cols-2">
      <article className="mes-surface p-5">
        <h2 className="mes-section-title m-0 flex items-center gap-2">
          <Radio size={18} />
          Live Stream yazımı
        </h2>
        <p className="mes-helper mt-2">
          Vardiya Başlat veya Fabrika Simülasyonu → her ~10 sn aktif hatlar için <code>POST /MachineMetrics</code> (~100–140 adetlik batch; 0–7 fire = Actual−Good → aynı Σ Fire SSOT).
          Manuel fire girişi de aynı endpoint’e yazar (Actual=adet, Good=0 → Σ Fire artar; vardiya bitince silinmez).
          Duruş/setup o hattı pause eder; üretime dönünce biriken süre downtime tick olarak yazılır.
          Simülasyon sunucuda rastgele iş emri + parti (200–1500) oluşturur; hedef dolunca lot/WO tamamlanır.
        </p>
      </article>
      <article className="mes-surface p-5">
        <h2 className="mes-section-title m-0 flex items-center gap-2">
          <Database size={18} />
          Okuyucular
        </h2>
        <ul className="mt-3 space-y-2 text-sm">
          <li>Fabrika / Operatör / İstasyon KPI → <code>GET /MachineMetrics/summary</code></li>
          <li>Trend / tablo → <code>GET /MachineMetrics</code></li>
          <li>OEE / Andon → latest metric + SignalR <code>oeeUpdated</code></li>
          <li>Lot → BatchController Σ Good sync</li>
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
{`[Fabrika Simülasyonu / Vardiya Başlat] (N hat)
      |  POST /Simulation/factory/start → WO + Lot (rastgele hedef)
      v
[Live Stream × N] --POST--> [MachineMetrics] (Actual/Good; fire=A−G) → Σ Fire += scrap
[Manuel Fire]     --POST--> [MachineMetrics] (Actual=N, Good=0)       → Σ Fire += N
[Üretime Dön]     --POST--> [MachineMetrics] (downtimeSeconds)        → Availability
      |                        |
      |                        +--> GET /summary --> Plant / Operator / Stations KPIs
      |                        +--> OeeCalculator --> SignalR oeeUpdated --> Andon
      |                        +--> Σ Good --> Batch.ProducedQuantity (+ WO complete)
      v
[Anomali] --> POST /Alarm --> Andon
[Hedef doldu / Vardiya Bitir] --> o hat PAUSE (diğerleri devam; metrik geçmişi kalır)`}
      </pre>
    </section>

    <div className="flex flex-wrap gap-2">
      <Link to="/kilavuz" className="mes-btn-secondary">Kullanım Kılavuzu</Link>
      <Link to="/makine-metrikleri" className="mes-btn-primary">Makine Metrikleri</Link>
      <Link to="/operator" className="mes-btn-secondary">Operatör · Vardiya</Link>
    </div>
  </div>
);

export default SystemFlowPage;
