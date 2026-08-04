import { useCallback, useMemo, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import MachineMetricsPanel from './components/MachineMetricsPanel';
import {
  Activity,
  Cpu,
  RefreshCw,
  LogOut,
  Monitor,
  Radio,
  BookOpen,
  Network,
  Menu,
  X,
  Building2,
  HardHat,
} from 'lucide-react';

import './App.css';
import { useAuth } from './context/AuthContext';
import { useNotify } from './context/NotificationContext';
import { PersonaProvider, usePersona } from './context/PersonaContext';
import { ShiftSessionProvider, useShiftSession } from './context/ShiftSessionContext';

import AppNavLinks from './components/AppNavLinks';
import PersonaSwitcher from './components/PersonaSwitcher';
import VestelMark from './components/VestelMark';
import LoginPage from './pages/LoginPage';
import QualityPage from './pages/QualityPage';
import StationsPage from './pages/StationsPage';
import AndonPage from './pages/AndonPage';
import OperatorGuidePage from './pages/OperatorGuidePage';
import SystemFlowPage from './pages/SystemFlowPage';
import PlantOverviewPage from './pages/PlantOverviewPage';
import OperatorDashboardPage from './pages/OperatorDashboardPage';
import { useTelemetry } from './hooks/useTelemetry';
import { useAlarms } from './hooks/useAlarms';
import { useWorkOrders } from './hooks/useWorkOrders';
import {
  ACTIVE_STATION_DEFINITIONS,
  DEFAULT_STATION,
} from './constants/stations';
import { getShiftLabel } from './constants/shifts';
import { emptyStationKpi } from './utils/telemetryAggregate';

function MainLayout() {
  const { currentUser, logout, isAuthenticated } = useAuth();
  const { notify, confirm } = useNotify();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const defaultPersona = currentUser?.roles?.includes('Operator') && !currentUser?.roles?.includes('Admin')
    ? 'operator'
    : 'admin';

  return (
    <PersonaProvider defaultPersona={defaultPersona} roles={currentUser?.roles || []}>
      <ShiftSessionProvider
        user={currentUser}
        notify={notify}
        canCreateAlarms={currentUser?.status === 'Aktif' && currentUser.permissions.includes('alarms.write')}
      >
        <MainLayoutShell
          currentUser={currentUser}
          logout={logout}
          notify={notify}
          confirm={confirm}
        />
      </ShiftSessionProvider>
    </PersonaProvider>
  );
}

function MainLayoutShell({ currentUser, logout, notify, confirm }) {
  const location = useLocation();
  const { persona, setPersona, isOperatorPersona, isExecutivePersona, allowedPersonas } = usePersona();
  const {
    shift,
    elapsedLabel,
    liveStreamActive,
    streamingStations,
    streamingStationIds,
    activeShifts,
    activeShiftCount,
  } = useShiftSession();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [selectedStationDetail, setSelectedStationDetail] = useState(DEFAULT_STATION);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const summaryShiftCode = useMemo(() => {
    if (!activeShifts.length) return undefined;
    const codes = [...new Set(activeShifts.map((entry) => entry.shiftCode).filter(Boolean))];
    return codes.length === 1 ? codes[0] : (shift.active ? shift.shiftCode : undefined);
  }, [activeShifts, shift.active, shift.shiftCode]);

  const summarySince = useMemo(() => {
    const starts = activeShifts
      .map((entry) => entry.startedAt)
      .filter(Boolean)
      .map((value) => new Date(value).getTime())
      .filter((value) => !Number.isNaN(value));
    if (!starts.length) return undefined;
    return new Date(Math.min(...starts)).toISOString();
  }, [activeShifts]);

  const isCurrentUserActive = currentUser?.status === 'Aktif';
  const hasPermission = (permission) => isCurrentUserActive && currentUser.permissions.includes(permission);

  const canIngestTelemetry = hasPermission('production.write');
  const canManageWorkOrders = hasPermission('workorders.manage');
  const canCreateAlarms = hasPermission('alarms.write');
  const canManageAlarms = hasPermission('alarms.manage');
  const canManageUsers = hasPermission('users.manage');

  const alarms = useAlarms({
    isAuthenticated: true,
    canCreateAlarms,
    canManageAlarms,
    notify,
    confirm,
  });

  const { raiseTelemetryAlarms } = alarms;
  const onSimulatedAnomalies = useCallback(async (stationId, anomalies) => {
    await raiseTelemetryAlarms(stationId, anomalies);
  }, [raiseTelemetryAlarms]);

  const telemetry = useTelemetry({
    isAuthenticated: true,
    canIngestTelemetry,
    autoRefresh,
    liveStreamActive,
    streamStations: streamingStations,
    summaryShiftCode,
    summarySince,
    onSimulatedAnomalies: canCreateAlarms ? onSimulatedAnomalies : undefined,
    notify,
  });

  const workOrders = useWorkOrders({
    isAuthenticated: true,
    canManageWorkOrders,
    notify,
  });

  const stationsList = useMemo(
    () => ACTIVE_STATION_DEFINITIONS.map((s) => s.id),
    [],
  );

  const detailKpi = telemetry.stationKpi(selectedStationDetail) || emptyStationKpi(selectedStationDetail);
  const stationMetrics = {
    total: detailKpi.actual,
    ok: detailKpi.good,
    nok: detailKpi.nok,
    yield: detailKpi.yield,
  };

  const recentTicksForStation = useMemo(
    () => telemetry.recentTicks.filter((tick) => tick.stationId === selectedStationDetail).slice(0, 6),
    [telemetry.recentTicks, selectedStationDetail],
  );

  const homePath = isOperatorPersona ? '/operator' : '/fabrika';

  const navItems = [
    ...(isExecutivePersona ? [{ to: '/fabrika', label: 'Fabrika Genel Bakış', icon: Building2, match: (path) => path === '/fabrika' }] : []),
    { to: '/operator', label: 'Operatör Paneli', icon: HardHat, match: (path) => path === '/operator' },
    { to: '/istasyonlar', label: 'İstasyonlar', icon: Cpu, match: (path) => path === '/istasyonlar' },
    { to: '/kalite', label: 'Kalite Raporları', icon: Activity, match: (path) => path === '/kalite' },
    { to: '/makine-metrikleri', label: 'Makine Metrikleri', icon: GaugeNavIcon, match: (path) => path === '/makine-metrikleri' },
    { to: '/andon', label: 'Andon Ekranı', icon: Monitor, match: (path) => path === '/andon' },
    { to: '/kilavuz', label: 'Kullanım Kılavuzu', icon: BookOpen, match: (path) => path === '/kilavuz' },
    { to: '/sistem', label: 'Sistem Akışı', icon: Network, match: (path) => path === '/sistem' },
  ];

  const pageTitle = navItems.find((item) => item.match(location.pathname))?.label || 'VESTEL MES';

  // Andon must stay inside MainLayout so Live Stream (useTelemetry) keeps posting
  // MachineMetrics → oeeUpdated while the saha ekranı is open.
  if (location.pathname === '/andon') {
    return <AndonPage />;
  }

  return (
    <div className="mes-shell">
      <aside className="mes-sidebar">
        <div className="mes-brand">
          <VestelMark className="text-[color:var(--color-vestel)]" size={28} />
          <span>VESTEL MES</span>
        </div>
        <AppNavLinks items={navItems} />
        <p className="mt-auto px-2 text-xs leading-relaxed text-slate-500">
          MachineMetrics SSOT · OEE · Andon
        </p>
      </aside>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <button type="button" className="absolute inset-0 bg-black/40" aria-label="Menüyü kapat" onClick={() => setMobileNavOpen(false)} />
          <aside className="relative z-10 flex h-full w-72 flex-col gap-4 bg-slate-950 p-4 text-slate-200">
            <div className="flex items-center justify-between">
              <div className="mes-brand text-base">
                <VestelMark className="text-[color:var(--color-vestel)]" size={22} />
                VESTEL MES
              </div>
              <button type="button" className="mes-btn-secondary border-slate-700 bg-slate-900 text-white" onClick={() => setMobileNavOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <AppNavLinks items={navItems} onNavigate={() => setMobileNavOpen(false)} />
          </aside>
        </div>
      )}

      <main className="mes-main">
        <header className="mes-topbar">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex min-w-0 items-center gap-3">
              <button type="button" className="mes-btn-secondary md:hidden" onClick={() => setMobileNavOpen(true)} aria-label="Menüyü aç">
                <Menu size={16} />
              </button>
              <div className="min-w-0">
                <h1 className="font-display m-0 truncate text-xl font-semibold tracking-wide text-[color:var(--color-ink)]">
                  {pageTitle}
                </h1>
                <p className="m-0 text-xs text-[color:var(--color-muted)] md:text-sm">
                  {isOperatorPersona ? 'Shop-floor operatör görünümü' : 'Yönetici / Ana Merkez görünümü'}
                  {liveStreamActive && canIngestTelemetry
                    ? ` · Live Stream (${streamingStationIds.length} hat)`
                    : liveStreamActive
                      ? ' · Vardiya açık (yazma yetkisi yok)'
                      : ''}
                </p>
              </div>
            </div>
            <PersonaSwitcher persona={persona} onSelect={setPersona} allowedPersonas={allowedPersonas} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              title={alarms.liveConnected ? 'SignalR bağlı' : 'SignalR yeniden bağlanıyor'}
              className={alarms.liveConnected ? 'mes-pill-ok' : 'mes-pill-warn'}
            >
              <Radio size={14} />
              {alarms.liveConnected ? 'Canlı' : 'Bağlantı Yok'}
            </span>
            {activeShiftCount > 0 && (
              <span className="mes-pill-ok" title="Aktif vardiya(lar)">
                {activeShiftCount > 1
                  ? `${activeShiftCount} hat aktif`
                  : `${shift.operatorName || 'Operatör'} · ${getShiftLabel(shift.shiftCode)} · ${elapsedLabel}`}
              </span>
            )}
            {liveStreamActive && canIngestTelemetry ? (
              <span className="mes-pill-warn" title="Vardiya Live Stream → MachineMetrics (çoklu hat)">
                <Activity size={14} />
                Live Stream{streamingStationIds.length > 1 ? ` · ${streamingStationIds.length}` : ''}
              </span>
            ) : liveStreamActive ? (
              <span className="mes-pill-neutral" title="Vardiya açık ancak production.write yok — telemetri tick yazılmıyor">
                Stream (yazma yok)
              </span>
            ) : (
              <span className="mes-pill-neutral" title="Vardiya Başlat ile telemetri akışı açılır">
                Stream Kapalı
              </span>
            )}
            <button
              type="button"
              onClick={() => setAutoRefresh((prev) => !prev)}
              className={autoRefresh ? 'mes-btn-primary' : 'mes-btn-secondary'}
            >
              <RefreshCw size={14} />
              {autoRefresh ? 'Oto Yenileme' : 'Yenileme Kapalı'}
            </button>
            <button type="button" onClick={() => telemetry.refresh()} className="mes-btn-secondary">
              <RefreshCw size={14} />
              Yenile
            </button>
            <div className="hidden items-center gap-2 rounded-lg border border-[color:var(--color-line)] bg-slate-50 px-3 py-1.5 sm:flex">
              <span className={`h-2.5 w-2.5 rounded-full ${isCurrentUserActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
              <div className="leading-tight">
                <div className="text-sm font-semibold">
                  {isOperatorPersona
                    ? (shift.operatorName || 'Operatör')
                    : currentUser.name}
                </div>
                <div className="text-xs text-[color:var(--color-muted)]">
                  {isOperatorPersona
                    ? `Operatör paneli · ${currentUser.status}`
                    : `${(currentUser.roles || []).join(' · ') || currentUser.role} · Yönetici paneli · ${currentUser.status}`}
                </div>
              </div>
            </div>
            <button type="button" onClick={logout} className="mes-btn-danger" title="Oturumu Kapat">
              <LogOut size={14} />
              Çıkış
            </button>
          </div>
        </header>

        <div className="mes-content">
          <Routes>
            <Route
              path="/fabrika"
              element={(
                <PlantOverviewPage
                  stationChartData={telemetry.stationChartData}
                  plantKpi={telemetry.plantKpi}
                  byStation={telemetry.byStation}
                  workOrders={workOrders.workOrders}
                  liveStreaming={liveStreamActive}
                />
              )}
            />

            <Route
              path="/operator"
              element={(
                <OperatorDashboardPage
                  currentUser={currentUser}
                  notify={notify}
                  stationKpi={telemetry.stationKpi}
                  recentTicks={telemetry.recentTicks}
                  workOrders={workOrders.workOrders}
                  batches={workOrders.batches}
                  liveStreaming={liveStreamActive}
                  canIngestTelemetry={canIngestTelemetry}
                  ingestManualScrap={telemetry.ingestManualScrap}
                  ingestDowntimeTick={telemetry.ingestDowntimeTick}
                  onRefreshOrders={async () => {
                    await Promise.all([
                      workOrders.loadWorkOrders?.(),
                      workOrders.loadBatches?.(),
                    ]);
                  }}
                />
              )}
            />

            <Route path="/dashboard" element={<Navigate to={homePath} replace />} />

            <Route
              path="/makine-metrikleri"
              element={(
                <MachineMetricsPanel
                  isFactorySimulationActive={liveStreamActive}
                  shiftStationId={shift.stationId}
                  shiftStationIds={streamingStationIds}
                  shiftActive={activeShiftCount > 0}
                  stationKpi={telemetry.stationKpi}
                  batches={workOrders.batches}
                  metricsFeed={telemetry.metrics}
                  preferSharedFeed={liveStreamActive}
                />
              )}
            />

            <Route
              path="/istasyonlar"
              element={(
                <StationsPage
                  stationChartData={telemetry.stationChartData}
                  stationDetailOptions={stationsList}
                  selectedStation={selectedStationDetail}
                  onStationChange={(event) => setSelectedStationDetail(event.target.value)}
                  onSelectStation={(stationId) => setSelectedStationDetail(stationId)}
                  stationMetrics={stationMetrics}
                  recentTicks={recentTicksForStation}
                  stations={stationsList}
                  byStation={telemetry.byStation}
                  liveStreaming={liveStreamActive}
                  activeShiftStationIds={streamingStationIds}
                />
              )}
            />

            <Route
              path="/kalite"
              element={(
                <QualityPage
                  workOrders={{
                    items: workOrders.workOrders,
                    onAdvance: workOrders.handleAdvanceWorkOrder,
                    onCreateSample: workOrders.handleCreateSampleWorkOrder,
                    creatingSample: workOrders.creatingSample,
                  }}
                  alarms={{
                    items: alarms.alarms,
                    loading: alarms.alarmLoading,
                    busyAlarmId: alarms.busyAlarmId,
                    error: alarms.alarmError,
                    onCreateTest: alarms.createTestAlarm,
                    onAcknowledge: alarms.handleAcknowledgeAlarm,
                    onResolve: alarms.handleResolveAlarm,
                  }}
                  batches={workOrders.batches}
                  scrapTicks={telemetry.scrapTicks}
                  plantKpi={telemetry.plantKpi}
                  permissions={{
                    canManageWorkOrders: canManageWorkOrders && isExecutivePersona,
                    canCreateAlarms,
                    canManageAlarms: canManageAlarms && isExecutivePersona,
                    canManageUsers: canManageUsers && isExecutivePersona,
                  }}
                  alarmForm={alarms.alarmForm}
                  workOrderForm={workOrders.workOrderForm}
                />
              )}
            />

            <Route path="/kilavuz" element={<OperatorGuidePage />} />
            <Route path="/sistem" element={<SystemFlowPage />} />
            <Route path="/" element={<Navigate to={homePath} replace />} />
            <Route path="*" element={<Navigate to={homePath} replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

function GaugeNavIcon(props) {
  return <Cpu {...props} />;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/*" element={<MainLayout />} />
    </Routes>
  );
}

export default App;
