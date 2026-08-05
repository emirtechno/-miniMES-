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
            MachineMetrics, ScrapLogs, ShiftSession ve StationRuntime backend doğruluk kaynağıdır.
            Frontend yalnızca okur ve operatör eylemlerini API üzerinden yazar.
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
        <li>NOK / Fire = Actual − Good (operatör fire ScrapLogs + NOK tick)</li>
        <li>Yield = Good / Actual × 100</li>
        <li>OEE = Availability × Performance × Quality (son MachineMetric tick)</li>
        <li>WO Completed / Lot Produced = ProductionProgressSync(delta Good)</li>
      </ul>
    </section>

    <section className="grid gap-4 md:grid-cols-2">
      <article className="mes-surface p-5">
        <h2 className="mes-section-title m-0 flex items-center gap-2">
          <Radio size={18} />
          Fabrika telemetrisi (backend)
        </h2>
        <p className="mes-helper mt-2">
          <code>OeeSimulationService</code> tüm istasyonlar için tick üretir; <code>StationRuntime</code>
          Running değilse Paused/Down downtime tick yazar. Ortak kapı: <code>IMetricIngestService</code>.
        </p>
      </article>
      <article className="mes-surface p-5">
        <h2 className="mes-section-title m-0 flex items-center gap-2">
          <Database size={18} />
          Okuyucular
        </h2>
        <ul className="mt-3 space-y-2 text-sm">
          <li>Katalog hat KPI / Andon → <code>GET /Oee/shift-current</code></li>
          <li>Operatör oturum KPI → <code>GET /ShiftSession/active</code></li>
          <li>Trend / tick → <code>GET /MachineMetrics</code></li>
          <li>SignalR → <code>oeeUpdated</code> / <code>telemetryTick</code> / <code>shiftUpdated</code> / alarm*</li>
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
{`[OeeSimulation / PLC / Scrap API]
      |
      v
[IMetricIngestService] --> MachineMetrics
      |                     +--> ProductionProgressSync --> WO + Lots
      |                     +--> TelemetryAnomaly --> Alarm + StationRuntime pause
      |                     +--> SignalR oeeUpdated / telemetryTick
      v
[ShiftSession API] --> StationRuntime (downtime/setup/resume gate)
[Alarm resolve] -----> pause reason clear (Running YALNIZCA operator resume)
[UI] <--- GET summary / active + SignalR (no FE tick POST, no sessionStorage domain)`}
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
