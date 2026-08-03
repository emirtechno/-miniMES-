import { useState } from 'react';
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
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
} from 'lucide-react';

import './App.css';
import { useAuth } from './context/AuthContext';
import { useNotify } from './context/NotificationContext';
import { downloadWorkbook } from './utils/excelExport';
import { getApiErrorMessage } from './services/api';

import DetailModal from './components/DetailModal';
import DashboardPage from './pages/DashboardPage';
import LoginPage from './pages/LoginPage';
import QualityPage from './pages/QualityPage';
import StationsPage from './pages/StationsPage';
import AndonPage from './pages/AndonPage';
import { useProduction } from './hooks/useProduction';
import { useAlarms } from './hooks/useAlarms';
import { useWorkOrders } from './hooks/useWorkOrders';
import { DEFAULT_STATION } from './constants/stations';

function MainLayout() {
  const { currentUser, logout, isAuthenticated } = useAuth();
  const { notify, confirm } = useNotify();
  const location = useLocation();

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

  const permissionText = !isCurrentUserActive
    ? 'Kullanıcınız PASİF durumdadır. İşlem yapamazsınız.'
    : canAddRecord && canChangeQuality
      ? 'Tüm üretim ve kalite işlemlerini yapabilirsiniz.'
      : canAddRecord
        ? 'Sadece üretim kayıtları ekleyebilirsiniz.'
        : canChangeQuality
          ? 'Sadece kalite durumlarını güncelleyebilirsiniz.'
          : 'Yalnızca raporları görüntüleyebilirsiniz.';

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

  const stationsList = [...new Set(production.records.map((r) => r.istasyonAdi).filter(Boolean))];
  const stationsFilterOptions = ['Tümü', ...stationsList];
  const stationDetailOptions = stationsList.length > 0 ? stationsList : [DEFAULT_STATION];
  const stationDetailRecords = production.records.filter((record) => record.istasyonAdi === selectedStationDetail);
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
    { name: 'OK (Başarılı)', value: okCount, color: '#10b981' },
    { name: 'NOK (Hatalı)', value: nokCount, color: '#ef4444' },
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
          istasyon: r.istasyonAdi,
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

  const isDashboardActive = location.pathname === '/dashboard' || location.pathname === '/';
  const isStationsActive = location.pathname === '/istasyonlar';
  const isQualityActive = location.pathname === '/kalite';
  const isMetricsActive = location.pathname === '/makine-metrikleri';

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="brand">
          <Factory className="brand-icon" size={28} />
          <span>VESTEL MES</span>
        </div>
        <ul className="menu-list">
          <li className={`menu-item ${isDashboardActive ? 'active' : ''}`}>
            <Link to="/dashboard" aria-current={isDashboardActive ? 'page' : undefined} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
              <LayoutDashboard size={20} />
              <span>Üretim Paneli</span>
            </Link>
          </li>
          <li className={`menu-item ${isStationsActive ? 'active' : ''}`}>
            <Link to="/istasyonlar" aria-current={isStationsActive ? 'page' : undefined} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
              <Cpu size={20} />
              <span>İstasyonlar</span>
            </Link>
          </li>
          <li className={`menu-item ${isQualityActive ? 'active' : ''}`}>
            <Link to="/kalite" aria-current={isQualityActive ? 'page' : undefined} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
              <Activity size={20} />
              <span>Kalite Raporları</span>
            </Link>
          </li>
          <li className={`menu-item ${isMetricsActive ? 'active' : ''}`}>
            <Link to="/makine-metrikleri" aria-current={isMetricsActive ? 'page' : undefined} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
              <Cpu size={20} />
              <span>Makine Metrikleri</span>
            </Link>
          </li>
          <li className="menu-item">
            <Link to="/andon" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
              <Monitor size={20} />
              <span>Andon Ekranı</span>
            </Link>
          </li>
        </ul>
      </aside>

      <main className="main-content">
        <header className="top-header">
          <div>
            <h1>
              {isDashboardActive && 'Üretim Takip ve Kontrol Paneli'}
              {isStationsActive && 'İstasyon Bazlı Üretim Performansı'}
              {isQualityActive && 'Kalite & Hata Analiz Raporları'}
              {isMetricsActive && 'Makine Telemetri ve Periyodik Metrikler'}
            </h1>
            <p>Saha Canlı Akış Verileri ve İstasyon Yönetimi</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span
              title={alarms.liveConnected ? 'SignalR bağlı' : 'SignalR yeniden bağlanıyor'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                borderRadius: '999px',
                border: '1px solid #e2e8f0',
                background: alarms.liveConnected ? '#ecfdf5' : '#fff7ed',
                color: alarms.liveConnected ? '#047857' : '#c2410c',
                fontWeight: 600,
              }}
            >
              <Radio size={16} />
              {alarms.liveConnected ? 'Canlı' : 'Bağlantı Yok'}
            </span>
            <button
              type="button"
              onClick={() => setIsFactorySimulationActive((prev) => !prev)}
              style={{
                background: isFactorySimulationActive ? '#10b981' : '#fff',
                color: isFactorySimulationActive ? '#fff' : '#10b981',
                border: '1px solid #10b981',
                borderRadius: '999px',
                padding: '8px 12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 600,
              }}
            >
              <Activity size={16} />
              {isFactorySimulationActive ? 'Simülasyon: ÇALIŞIYOR' : 'Simülasyonu Başlat'}
            </button>
            <button
              type="button"
              onClick={() => setAutoRefresh((prev) => !prev)}
              style={{
                background: autoRefresh ? '#0f172a' : '#fff',
                color: autoRefresh ? '#fff' : '#0f172a',
                border: '1px solid #e2e8f0',
                borderRadius: '999px',
                padding: '8px 12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 600,
              }}
            >
              <RefreshCw size={16} />
              {autoRefresh ? 'Otomatik Yenileme Açık' : 'Otomatik Yenileme Kapalı'}
            </button>
            <button
              type="button"
              onClick={() => production.fetchRecords()}
              style={{
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '999px',
                padding: '8px 12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 600,
                color: '#0f172a',
              }}
            >
              <RefreshCw size={16} />
              Yenile
            </button>
            <div className="user-badge" style={{ minWidth: '220px' }}>
              <div className="status-dot" style={{ backgroundColor: isCurrentUserActive ? '#10b981' : '#ef4444' }} />
              <div>
                <div style={{ fontWeight: 700 }}>{currentUser.name}</div>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{currentUser.role} - {currentUser.status}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={logout}
              className="btn-primary"
              style={{ background: '#ef4444', borderColor: '#ef4444', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
              title="Oturumu Kapat"
            >
              <LogOut size={16} />
              Çıkış
            </button>
          </div>
        </header>

        <Routes>
          <Route
            path="/dashboard"
            element={(
              <DashboardPage
                metrics={{ totalCount, okCount, nokCount, yieldRate, qualityChartData }}
                permission={{ isActive: isCurrentUserActive, text: permissionText }}
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
                stationMetrics={stationMetrics}
                recentRecords={stationDetailRecords.slice(0, 4)}
                stations={stationsList}
                records={production.records}
              />
            )}
          />

          <Route
            path="/kalite"
            element={(
              <QualityPage
                workOrders={{ items: workOrders.workOrders, onAdvance: workOrders.handleAdvanceWorkOrder }}
                alarms={{
                  items: alarms.alarms,
                  loading: alarms.alarmLoading,
                  error: alarms.alarmError,
                  onCreateTest: alarms.createTestAlarm,
                  onAcknowledge: alarms.handleAcknowledgeAlarm,
                  onDelete: alarms.handleDeleteAlarm,
                }}
                batches={workOrders.batches}
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

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
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
