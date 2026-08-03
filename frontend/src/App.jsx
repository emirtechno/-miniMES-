import { useMemo, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import MachineMetricsPanel from './components/MachineMetricsPanel';
import {
  Factory,
  Activity,
  LayoutDashboard,
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
import { downloadWorkbook } from './utils/excelExport';
import { getApiErrorMessage } from './services/api';

import DetailModal from './components/DetailModal';
import AppNavLinks from './components/AppNavLinks';
import DashboardPage from './pages/DashboardPage';
import LoginPage from './pages/LoginPage';
import QualityPage from './pages/QualityPage';
import StationsPage from './pages/StationsPage';
import AndonPage from './pages/AndonPage';
import OperatorGuidePage from './pages/OperatorGuidePage';
import SystemFlowPage from './pages/SystemFlowPage';
import PlantOverviewPage from './pages/PlantOverviewPage';
import OperatorDashboardPage from './pages/OperatorDashboardPage';
import { useProduction } from './hooks/useProduction';
import { useAlarms } from './hooks/useAlarms';
import { useWorkOrders } from './hooks/useWorkOrders';
import {
  ACTIVE_STATION_DEFINITIONS,
  DEFAULT_STATION,
  getStationDisplayName,
} from './constants/stations';

function MainLayout() {
  const { currentUser, logout, isAuthenticated } = useAuth();
  const { notify, confirm } = useNotify();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStation, setSelectedStation] = useState('Tümü');
  const [selectedQuality, setSelectedQuality] = useState('Tümü');
  const [selectedStationDetail, setSelectedStationDetail] = useState(DEFAULT_STATION);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isFactorySimulationActive, setIsFactorySimulationActive] = useState(false);

  const isCurrentUserActive = currentUser?.status === 'Aktif';
  const hasPermission = (permission) => isCurrentUserActive && currentUser.permissions.includes(permission);

  const canAddRecord = hasPermission('production.write');
  const canChangeQuality = hasPermission('production.manage');
  const canDeleteRecord = hasPermission('production.manage');
  const canHardDelete = hasPermission('production.hard-delete');
  const canManageWorkOrders = hasPermission('workorders.manage');
  const canCreateAlarms = hasPermission('alarms.write');
  const canManageAlarms = hasPermission('alarms.manage');
  const canManageUsers = hasPermission('users.manage');
  const canViewDeleted = hasPermission('deleted-records.read');

  const production = useProduction({
    isAuthenticated,
    canViewDeleted,
    canAddRecord,
    autoRefresh,
    factorySimulationActive: isFactorySimulationActive,
    notify,
    confirm,
  });

  const alarms = useAlarms({
    isAuthenticated,
    canCreateAlarms,
    canManageAlarms,
    notify,
    confirm,
  });

  const workOrders = useWorkOrders({
    isAuthenticated,
    canManageWorkOrders,
    notify,
  });

  const stationsList = useMemo(() => {
    const fromRecords = production.records.map((r) => r.istasyonAdi).filter(Boolean);
    return [...new Set([...ACTIVE_STATION_DEFINITIONS.map((s) => s.id), ...fromRecords])];
  }, [production.records]);

  const stationsFilterOptions = ['Tümü', ...stationsList];
  const stationDetailOptions = stationsList.length > 0 ? stationsList : [DEFAULT_STATION];
  const stationDetailRecords = production.records
    .filter((record) => record.istasyonAdi === selectedStationDetail)
    .slice()
    .sort((a, b) => new Date(b.uretimTarihi || 0) - new Date(a.uretimTarihi || 0));
  const stationMetrics = {
    total: stationDetailRecords.length,
    ok: stationDetailRecords.filter((record) => record.kaliteDurumu === 'OK').length,
    nok: stationDetailRecords.filter((record) => record.kaliteDurumu === 'NOK').length,
    yield: stationDetailRecords.length > 0
      ? ((stationDetailRecords.filter((record) => record.kaliteDurumu === 'OK').length / stationDetailRecords.length) * 100).toFixed(1)
      : 0,
  };

  const filteredRecords = production.records.filter((r) => {
    const matchesSearch =
      (r.urun20liKod && r.urun20liKod.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (r.malzeme12liKod && r.malzeme12liKod.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStation = selectedStation === 'Tümü' || r.istasyonAdi === selectedStation;
    const matchesQuality = selectedQuality === 'Tümü' || r.kaliteDurumu === selectedQuality;
    return matchesSearch && matchesStation && matchesQuality;
  });

  const liveOk = production.records.filter((r) => r.kaliteDurumu === 'OK').length;
  const liveNok = production.records.filter((r) => r.kaliteDurumu === 'NOK').length;
  const totalCount = liveOk + liveNok;
  const okCount = liveOk;
  const nokCount = liveNok;
  const yieldRate = totalCount > 0 ? ((okCount / totalCount) * 100).toFixed(1) : 0;
  const qualityChartData = [
    { name: 'OK (Başarılı)', value: okCount, color: '#0f9f6e' },
    { name: 'NOK (Hatalı)', value: nokCount, color: '#d92d20' },
  ];
  const stationChartData = stationsList.map((st) => {
    const stRecords = production.records.filter((r) => r.istasyonAdi === st);
    return {
      name: st,
      OK: stRecords.filter((r) => r.kaliteDurumu === 'OK').length,
      NOK: stRecords.filter((r) => r.kaliteDurumu === 'NOK').length,
    };
  });

  const handleExportExcel = async () => {
    const exportData = filteredRecords.length > 0 ? filteredRecords : production.records;
    if (!exportData || exportData.length === 0) {
      notify('Dışa aktarılacak veri bulunamadı!', 'error');
      return;
    }
    try {
      const tarih = new Date().toLocaleDateString('tr-TR').replace(/\./g, '_');
      await downloadWorkbook({
        sheetName: 'Üretim Raporu',
        fileName: `Vestel_MES_Uretim_Raporu_${tarih}.xlsx`,
        columns: [
          { header: 'Kayıt ID', key: 'id', width: 10 },
          { header: "20'li Ürün Kodu", key: 'urun', width: 25 },
          { header: "12'li Malzeme Kodu", key: 'malzeme', width: 18 },
          { header: 'İstasyon Adı', key: 'istasyon', width: 25 },
          { header: 'Kalite Durumu', key: 'kalite', width: 15 },
          { header: 'Üretim Tarihi (UTC)', key: 'tarih', width: 28 },
        ],
        rows: exportData.map((r) => ({
          id: r.id,
          urun: r.urun20liKod,
          malzeme: r.malzeme12liKod,
          istasyon: getStationDisplayName(r.istasyonAdi),
          kalite: r.kaliteDurumu,
          tarih: r.uretimTarihi
            ? `${new Date(r.uretimTarihi).toLocaleString('tr-TR', { timeZone: 'UTC' })} UTC`
            : '-',
        })),
      });
    } catch (err) {
      notify(getApiErrorMessage(err, 'Excel dışa aktarma başarısız oldu.'), 'error');
    }
  };

  const isPlantManager = currentUser?.roles?.includes('Admin');
  const isOperatorRole = currentUser?.roles?.includes('Operator') && !isPlantManager;
  const homePath = isPlantManager ? '/fabrika' : isOperatorRole ? '/operator' : '/dashboard';

  const navItems = [
    ...(isPlantManager ? [{ to: '/fabrika', label: 'Fabrika Genel Bakış', icon: Building2, match: (path) => path === '/fabrika' }] : []),
    ...((isOperatorRole || isPlantManager) ? [{ to: '/operator', label: 'Operatör Paneli', icon: HardHat, match: (path) => path === '/operator' }] : []),
    { to: '/dashboard', label: 'Üretim Paneli', icon: LayoutDashboard, match: (path) => path === '/dashboard' },
    { to: '/istasyonlar', label: 'İstasyonlar', icon: Cpu, match: (path) => path === '/istasyonlar' },
    { to: '/kalite', label: 'Kalite Raporları', icon: Activity, match: (path) => path === '/kalite' },
    { to: '/makine-metrikleri', label: 'Makine Metrikleri', icon: GaugeNavIcon, match: (path) => path === '/makine-metrikleri' },
    { to: '/andon', label: 'Andon Ekranı', icon: Monitor, match: (path) => path === '/andon' },
    { to: '/kilavuz', label: 'Kullanım Kılavuzu', icon: BookOpen, match: (path) => path === '/kilavuz' },
    { to: '/sistem', label: 'Sistem Akışı', icon: Network, match: (path) => path === '/sistem' },
  ];

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const pageTitle = navItems.find((item) => item.match(location.pathname))?.label || 'VESTEL MES';

  return (
    <div className="mes-shell">
      <aside className="mes-sidebar">
        <div className="mes-brand">
          <Factory className="text-[color:var(--color-vestel)]" size={28} />
          <span>VESTEL MES</span>
        </div>
        <AppNavLinks items={navItems} />
        <p className="mt-auto px-2 text-xs leading-relaxed text-slate-500">
          Saha paneli · Canlı OEE · Andon
        </p>
      </aside>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <button type="button" className="absolute inset-0 bg-black/40" aria-label="Menüyü kapat" onClick={() => setMobileNavOpen(false)} />
          <aside className="relative z-10 flex h-full w-72 flex-col gap-4 bg-slate-950 p-4 text-slate-200">
            <div className="flex items-center justify-between">
              <div className="mes-brand text-base">
                <Factory className="text-[color:var(--color-vestel)]" size={22} />
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
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" className="mes-btn-secondary md:hidden" onClick={() => setMobileNavOpen(true)} aria-label="Menüyü aç">
              <Menu size={16} />
            </button>
            <div className="min-w-0">
              <h1 className="font-display m-0 truncate text-xl font-semibold tracking-wide text-[color:var(--color-ink)]">
                {pageTitle}
              </h1>
              <p className="m-0 text-xs text-[color:var(--color-muted)] md:text-sm">Saha canlı akış verileri ve istasyon yönetimi</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              title={alarms.liveConnected ? 'SignalR bağlı' : 'SignalR yeniden bağlanıyor'}
              className={alarms.liveConnected ? 'mes-pill-ok' : 'mes-pill-warn'}
            >
              <Radio size={14} />
              {alarms.liveConnected ? 'Canlı' : 'Bağlantı Yok'}
            </span>
            <button
              type="button"
              onClick={() => setIsFactorySimulationActive((prev) => !prev)}
              className={isFactorySimulationActive ? 'mes-btn-primary' : 'mes-btn-secondary'}
            >
              <Activity size={14} />
              {isFactorySimulationActive ? 'Simülasyon: Açık' : 'Simülasyonu Başlat'}
            </button>
            <button
              type="button"
              onClick={() => setAutoRefresh((prev) => !prev)}
              className={autoRefresh ? 'mes-btn-primary' : 'mes-btn-secondary'}
            >
              <RefreshCw size={14} />
              {autoRefresh ? 'Oto Yenileme' : 'Yenileme Kapalı'}
            </button>
            <button type="button" onClick={() => production.fetchRecords()} className="mes-btn-secondary">
              <RefreshCw size={14} />
              Yenile
            </button>
            <div className="hidden items-center gap-2 rounded-lg border border-[color:var(--color-line)] bg-slate-50 px-3 py-1.5 sm:flex">
              <span className={`h-2.5 w-2.5 rounded-full ${isCurrentUserActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
              <div className="leading-tight">
                <div className="text-sm font-semibold">{currentUser.name}</div>
                <div className="text-xs text-[color:var(--color-muted)]">{currentUser.role} · {currentUser.status}</div>
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
              element={isPlantManager ? (
                <PlantOverviewPage
                  stationChartData={stationChartData}
                  records={production.records}
                  workOrders={workOrders.workOrders}
                />
              ) : (
                <Navigate to={homePath} replace />
              )}
            />

            <Route
              path="/operator"
              element={(isOperatorRole || isPlantManager) ? (
                <OperatorDashboardPage
                  currentUser={currentUser}
                  notify={notify}
                  canCreateAlarms={canCreateAlarms}
                  canSubmit={canAddRecord}
                  form={{
                    urun20liKod: production.form.urun20liKod,
                    malzeme12liKod: production.form.malzeme12liKod,
                    istasyonAdi: production.form.istasyonAdi,
                    kaliteDurumu: production.form.kaliteDurumu,
                    onChangeUrun: (event) => production.form.setUrun20liKod(event.target.value),
                    onChangeMalzeme: (event) => production.form.setMalzeme12liKod(event.target.value),
                    onChangeStation: (event) => production.form.setIstasyonAdi(event.target.value),
                    onChangeQuality: (event) => production.form.setKaliteDurumu(event.target.value),
                    onSubmit: production.form.onSubmit,
                    onGenerateRandom: production.form.onGenerateRandom,
                    urunInputRef: production.form.urunInputRef,
                    malzemeInputRef: production.form.malzemeInputRef,
                    canSubmit: canAddRecord,
                  }}
                  records={production.records}
                  workOrders={workOrders.workOrders}
                />
              ) : (
                <Navigate to={homePath} replace />
              )}
            />

            <Route
              path="/dashboard"
              element={(
                <DashboardPage
                  metrics={{ totalCount, okCount, nokCount, yieldRate, qualityChartData }}
                  form={{
                    urun20liKod: production.form.urun20liKod,
                    malzeme12liKod: production.form.malzeme12liKod,
                    istasyonAdi: production.form.istasyonAdi,
                    kaliteDurumu: production.form.kaliteDurumu,
                    onChangeUrun: (event) => production.form.setUrun20liKod(event.target.value),
                    onChangeMalzeme: (event) => production.form.setMalzeme12liKod(event.target.value),
                    onChangeStation: (event) => production.form.setIstasyonAdi(event.target.value),
                    onChangeQuality: (event) => production.form.setKaliteDurumu(event.target.value),
                    onSubmit: production.form.onSubmit,
                    onGenerateRandom: production.form.onGenerateRandom,
                    urunInputRef: production.form.urunInputRef,
                    malzemeInputRef: production.form.malzemeInputRef,
                    canSubmit: canAddRecord,
                  }}
                  table={{
                    records: production.records,
                    loading: production.loading,
                    error: production.error,
                    filteredRecords,
                    searchTerm,
                    selectedStation,
                    selectedQuality,
                    stationsFilterOptions,
                    onSearchChange: (event) => setSearchTerm(event.target.value),
                    onStationChange: (event) => setSelectedStation(event.target.value),
                    onQualityChange: (event) => setSelectedQuality(event.target.value),
                    onExportExcel: handleExportExcel,
                    onToggleQuality: canChangeQuality ? production.handleToggleQuality : undefined,
                    canChangeQuality,
                    canDeleteRecord,
                    onDelete: canDeleteRecord ? production.handleDelete : undefined,
                    onOpenDetail: (record) => {
                      setSelectedRecord(record);
                      setIsModalOpen(true);
                    },
                  }}
                  pagination={{
                    hasMore: Boolean(production.nextProductionCursor),
                    loadMore: production.loadMoreRecords,
                    loading: production.loadingMoreRecords,
                  }}
                />
              )}
            />

            <Route path="/makine-metrikleri" element={<MachineMetricsPanel />} />

            <Route
              path="/istasyonlar"
              element={(
                <StationsPage
                  stationChartData={stationChartData}
                  stationDetailOptions={stationDetailOptions}
                  selectedStation={selectedStationDetail}
                  onStationChange={(event) => setSelectedStationDetail(event.target.value)}
                  onSelectStation={(stationId) => setSelectedStationDetail(stationId)}
                  stationMetrics={stationMetrics}
                  recentRecords={stationDetailRecords.slice(0, 6)}
                  stations={stationsList}
                  records={production.records}
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
                    onCreateTest: alarms.createTestAlarm,
                    onAcknowledge: alarms.handleAcknowledgeAlarm,
                    onDelete: alarms.handleDeleteAlarm,
                  }}
                  batches={workOrders.batches}
                  batchActions={{
                    onAdvance: workOrders.handleAdvanceBatch,
                    onReopen: workOrders.handleReopenBatch,
                    onProgress: workOrders.handleUpdateBatchProgress,
                    busyId: workOrders.batchBusyId,
                  }}
                  deleted={{
                    items: production.deletedRecords,
                    loading: production.deletedLoading,
                    error: production.deletedError,
                    onRestore: production.handleRestore,
                    onHardDelete: canHardDelete ? production.handleHardDelete : undefined,
                  }}
                  production={{
                    records: production.records,
                    onToggleQuality: production.handleToggleQuality,
                    onDelete: production.handleDelete,
                  }}
                  permissions={{
                    canManageWorkOrders,
                    canCreateAlarms,
                    canManageAlarms,
                    canManageUsers,
                    canViewDeleted,
                    canManageProduction: canDeleteRecord,
                    canHardDelete,
                    canChangeQuality,
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

      <DetailModal
        record={selectedRecord}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedRecord(null);
        }}
      />
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
