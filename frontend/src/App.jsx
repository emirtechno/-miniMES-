import { useMemo, useState } from 'react';
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
  Settings,
} from 'lucide-react';

import './App.css';
import { AUTHOR_CREDIT, SIDEBAR_TECH_LINE } from './attribution';
// Author credit (CI attribution guard): Emir Kuru 1022041 Vestel Teknoloji Müdürlüğü (ARGE-ÜRETİM-KALİTE) Stajyeri
import { useAuth } from './context/AuthContext';
import { useNotify } from './context/NotificationContext';
import {
  PERSONA_ALLOWED_PATHS,
  PersonaProvider,
  usePersona,
} from './context/PersonaContext';
import { ShiftSessionProvider, useShiftSession } from './context/ShiftSessionContext';

import AppNavLinks from './components/AppNavLinks';
import PersonaSwitcher from './components/PersonaSwitcher';
import FactorySimulationToggle from './components/FactorySimulationToggle';
import VestelMark from './components/VestelMark';
import LoginPage from './pages/LoginPage';
import QualityPage from './pages/QualityPage';
import AdminPage from './pages/AdminPage';
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
  const {
    persona,
    setPersona,
    isOperatorPersona,
    isExecutivePersona,
    allowedPersonas,
    isPathAllowed,
    homePath,
  } = usePersona();
  const { shift, elapsedLabel } = useShiftSession();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [selectedStationDetail, setSelectedStationDetail] = useState(DEFAULT_STATION);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const isCurrentUserActive = currentUser?.status === 'Aktif';
  const hasPermission = (permission) => isCurrentUserActive && currentUser.permissions.includes(permission);

  const canManageWorkOrders = hasPermission('workorders.manage');
  const canCreateAlarms = hasPermission('alarms.write');
  const canManageAlarms = hasPermission('alarms.manage');
  const canManageUsers = hasPermission('users.manage');
  const canResetShopFloor = hasPermission('simulation.control');

  // Shift-active indicator (not FE ingest). Backend OeeSimulation owns MachineMetrics writes.
  const liveStreamActive = Boolean(shift.active && !shift.onBreak && !shift.inSetup);
  const streamStationId = shift.active ? shift.stationId : null;

  const alarms = useAlarms({
    isAuthenticated: true,
    canCreateAlarms,
    canManageAlarms,
    notify,
    confirm,
  });

  const telemetry = useTelemetry({
    isAuthenticated: true,
    autoRefresh,
    liveStreamActive,
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

  const recentTicksForStation = useMemo(
    () => telemetry.recentTicks.filter((tick) => tick.stationId === selectedStationDetail).slice(0, 6),
    [telemetry.recentTicks, selectedStationDetail],
  );

  const allNavItems = [
    { to: '/fabrika', label: 'Fabrika Genel Bakış', icon: Building2, match: (path) => path === '/fabrika' },
    { to: '/operator', label: 'Operatör Paneli', icon: HardHat, match: (path) => path === '/operator' },
    { to: '/istasyonlar', label: 'İstasyonlar', icon: Cpu, match: (path) => path === '/istasyonlar' },
    { to: '/kalite', label: 'Kalite Raporları', icon: Activity, match: (path) => path === '/kalite' },
    { to: '/makine-metrikleri', label: 'Makine Metrikleri', icon: GaugeNavIcon, match: (path) => path === '/makine-metrikleri' },
    { to: '/andon', label: 'Andon Ekranı', icon: Monitor, match: (path) => path === '/andon' },
    { to: '/yonetim', label: 'Yönetim', icon: Settings, match: (path) => path === '/yonetim' },
    { to: '/kilavuz', label: 'Kullanım Kılavuzu', icon: BookOpen, match: (path) => path === '/kilavuz' },
    { to: '/sistem', label: 'Sistem Akışı', icon: Network, match: (path) => path === '/sistem' },
  ];

  const allowedPaths = PERSONA_ALLOWED_PATHS[persona] || [];
  const navItems = allNavItems.filter((item) => allowedPaths.includes(item.to));

  const pageTitle = allNavItems.find((item) => item.match(location.pathname))?.label || 'VESTEL MES';

  if (!isPathAllowed(location.pathname)) {
    return <Navigate to={homePath} replace />;
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
          {SIDEBAR_TECH_LINE}
          <br />
          <span className="mt-1 block text-[0.7rem] text-slate-400">
            - {AUTHOR_CREDIT} -
          </span>
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
          <div className="mes-topbar-brand">
            <button type="button" className="mes-btn-compact mes-btn-secondary shrink-0 md:hidden" onClick={() => setMobileNavOpen(true)} aria-label="Menüyü aç">
              <Menu size={16} />
            </button>
            <div className="mes-topbar-titles">
              <h1>{pageTitle}</h1>
              <p title={isOperatorPersona
                ? 'Shop-floor operatör görünümü'
                : persona === 'it-admin'
                  ? 'IT Yönetici görünümü'
                  : 'Yönetici / Ana Merkez görünümü'}
              >
                {isOperatorPersona
                  ? 'Shop-floor operatör görünümü'
                  : persona === 'it-admin'
                    ? 'IT Yönetici görünümü'
                    : 'Yönetici / Ana Merkez görünümü'}
              </p>
            </div>
          </div>

          <div className="mes-topbar-persona">
            <PersonaSwitcher persona={persona} onSelect={setPersona} allowedPersonas={allowedPersonas} />
          </div>

          <div className="mes-topbar-actions">
            <span
              title={alarms.liveConnected ? 'SignalR bağlı' : 'SignalR yeniden bağlanıyor'}
              className={alarms.liveConnected ? 'mes-pill-ok' : 'mes-pill-warn'}
            >
              <Radio size={12} />
              {alarms.liveConnected ? 'Canlı' : 'Yok'}
            </span>
            <FactorySimulationToggle compact />
            {shift.active ? (
              <span
                className="mes-pill-ok mes-topbar-shift"
                title={`${shift.operatorName || 'Operatör'} · ${getShiftLabel(shift.shiftCode)} · ${elapsedLabel}`}
              >
                {getShiftLabel(shift.shiftCode)} · {elapsedLabel}
              </span>
            ) : (
              <span className="mes-pill-neutral" title="Vardiya Başlat ile operatör oturumu açılır">
                Kapalı
              </span>
            )}
            {liveStreamActive && (
              <span
                className="mes-pill-warn mes-topbar-telem"
                title="Fabrika telemetrisi (backend) aktif"
                aria-label="Fabrika telemetrisi aktif"
              >
                <Activity size={12} />
                <span className="mes-topbar-telem-label">Telemetri</span>
              </span>
            )}
            <button
              type="button"
              onClick={() => setAutoRefresh((prev) => !prev)}
              className={`mes-btn-compact ${autoRefresh ? 'mes-btn-primary' : 'mes-btn-secondary'}`}
              title={autoRefresh ? 'Otomatik yenileme açık' : 'Otomatik yenileme kapalı'}
            >
              <RefreshCw size={13} />
              <span className="mes-topbar-btn-label">{autoRefresh ? 'Oto' : 'Manuel'}</span>
            </button>
            <button
              type="button"
              onClick={() => telemetry.refresh()}
              className="mes-btn-compact mes-btn-secondary"
              title="Şimdi yenile"
            >
              <RefreshCw size={13} />
              <span className="mes-topbar-btn-label">Yenile</span>
            </button>
            <div className="mes-topbar-user">
              <span className={`mes-topbar-user-dot ${isCurrentUserActive ? 'is-active' : ''}`} />
              <span className="mes-topbar-user-name" title={isOperatorPersona
                ? (shift.operatorName || 'Operatör')
                : `${currentUser.name} · ${(currentUser.roles || []).join(', ') || currentUser.role}`}>
                {isOperatorPersona
                  ? (shift.operatorName || 'Operatör')
                  : currentUser.name}
              </span>
              <button type="button" onClick={logout} className="mes-btn-compact mes-btn-danger" title="Oturumu Kapat">
                <LogOut size={13} />
                <span className="mes-topbar-btn-label">Çıkış</span>
              </button>
            </div>
          </div>
        </header>

        <div className="mes-content">
          <Routes>
            <Route
              path="/fabrika"
              element={(
                <PlantOverviewPage
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
                  recentTicks={telemetry.recentTicks}
                  workOrders={workOrders.workOrders}
                  batches={workOrders.batches}
                  liveStreaming={liveStreamActive}
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
                  shiftActive={shift.active}
                  metricsFeed={telemetry.metrics}
                />
              )}
            />

            <Route
              path="/istasyonlar"
              element={(
                <StationsPage
                  stationDetailOptions={stationsList}
                  selectedStation={selectedStationDetail}
                  onStationChange={(event) => setSelectedStationDetail(event.target.value)}
                  onSelectStation={(stationId) => setSelectedStationDetail(stationId)}
                  recentTicks={recentTicksForStation}
                  stations={stationsList}
                  liveStreaming={liveStreamActive}
                  activeShiftStationId={streamStationId}
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
                    error: alarms.alarmError,
                    onAcknowledge: alarms.handleAcknowledgeAlarm,
                    onResolve: alarms.handleResolveAlarm,
                  }}
                  batches={workOrders.batches}
                  scrapTicks={telemetry.scrapTicks}
                  plantKpi={telemetry.plantKpi}
                  permissions={{
                    canManageWorkOrders: canManageWorkOrders && isExecutivePersona,
                    canManageAlarms: canManageAlarms && isExecutivePersona,
                  }}
                  workOrderForm={workOrders.workOrderForm}
                />
              )}
            />

            <Route
              path="/yonetim"
              element={(
                <AdminPage
                  permissions={{
                    canManageUsers: canManageUsers && isExecutivePersona,
                    canCreateAlarms: canCreateAlarms && isExecutivePersona,
                    canResetShopFloor: canResetShopFloor && isExecutivePersona,
                  }}
                  alarms={{
                    loading: alarms.alarmLoading,
                    error: alarms.alarmError,
                    onCreateTest: alarms.createTestAlarm,
                  }}
                  alarmForm={alarms.alarmForm}
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
      <Route path="/andon" element={<AndonPage />} />
      <Route path="/*" element={<MainLayout />} />
    </Routes>
  );
}

export default App;
