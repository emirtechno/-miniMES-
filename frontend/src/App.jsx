import { useState, useEffect, useRef } from 'react';
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import MachineMetricsPanel from './components/MachineMetricsPanel';
import * as XLSX from 'xlsx';
import { 
  Factory, 
  Activity,
  LayoutDashboard,
  Cpu,
  RefreshCw,
  LogOut
} from 'lucide-react';

import './App.css';
import { useAuth } from './context/AuthContext';
import { useNotify } from './context/NotificationContext';
import {
  createProductionRecord,
  deleteProductionRecord,
  fetchProductionRecords,
  fetchDeletedProductionRecords,
  fetchAlarms,
  acknowledgeAlarm,
  createAlarm,
  restoreProductionRecord,
  deleteAlarm,
  hardDeleteProductionRecord,
  updateProductionRecord,
  fetchWorkOrders,
  createWorkOrder,
  advanceWorkOrder,
  fetchBatches,
  getApiErrorMessage
} from './services/api';

import DetailModal from './components/DetailModal';
import DashboardPage from './pages/DashboardPage';
import LoginPage from './pages/LoginPage';
import QualityPage from './pages/QualityPage';
import StationsPage from './pages/StationsPage';
import { useNonOverlappingPolling } from './hooks/useNonOverlappingPolling';
import { DEFAULT_STATION, STATIONS } from './constants/stations';

function MainLayout() {
  const { currentUser, logout, isAuthenticated } = useAuth();
  const { notify, confirm } = useNotify();
  const location = useLocation();

  const [records, setRecords] = useState([]);
  const [nextProductionCursor, setNextProductionCursor] = useState(null);
  const [loadingMoreRecords, setLoadingMoreRecords] = useState(false);
  const [deletedRecords, setDeletedRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletedLoading, setDeletedLoading] = useState(false);
  const [alarmLoading, setAlarmLoading] = useState(false);
  const [error, setError] = useState(null);
  const [deletedError, setDeletedError] = useState(null);
  const [alarmError, setAlarmError] = useState(null);

  // Form alanları
  const [urun20liKod, setUrun20liKod] = useState('');
  const [malzeme12liKod, setMalzeme12liKod] = useState('');
  const [istasyonAdi, setIstasyonAdi] = useState('');
  const [kaliteDurumu, setKaliteDurumu] = useState('OK');

  // Ref'ler
  const urunInputRef = useRef(null);
  const malzemeInputRef = useRef(null);
  const productionRequestIdRef = useRef(0);

  // Filtreleme
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStation, setSelectedStation] = useState('Tümü');
  const [selectedQuality, setSelectedQuality] = useState('Tümü');
  const [selectedStationDetail, setSelectedStationDetail] = useState(DEFAULT_STATION);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isFactorySimulationActive, setIsFactorySimulationActive] = useState(false);
  
  const [workOrders, setWorkOrders] = useState([]);
  const [workOrderForm, setWorkOrderForm] = useState({ orderNo: '', product: '', station: '', quantity: '' });
  const [alarms, setAlarms] = useState([]);
  const [batches, setBatches] = useState([]);

  // Manuel alarm form state
  const [manualTitle, setManualTitle] = useState('');
  const [manualStation, setManualStation] = useState(DEFAULT_STATION);
  const [manualSeverity, setManualSeverity] = useState('Uyarı');
  const [manualDescription, setManualDescription] = useState('');

  // ==========================================
  // 🎯 KESİN ROL VE YETKİ KONTROLLERİ
  // ==========================================
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

  const fetchRecords = async (signal, { background = false } = {}) => {
    const requestId = ++productionRequestIdRef.current;
    try {
      if (!background) setLoading(true);
      const page = await fetchProductionRecords({ signal });
      if (requestId !== productionRequestIdRef.current) return;
      const activeItems = page.items.filter((r) => !(r?.isDeleted ?? r?.IsDeleted ?? false));
      if (background) {
        setRecords((current) => {
          const latestIds = new Set(activeItems.map((record) => record.id));
          return [...activeItems, ...current.filter((record) => !latestIds.has(record.id))];
        });
      } else {
        setRecords(activeItems);
        setNextProductionCursor(page.nextCursor);
      }
      setError(null);
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') return;
      if (requestId === productionRequestIdRef.current) {
        setError(getApiErrorMessage(err, 'API bağlantısı başarısız oldu.'));
      }
      console.error(err);
    } finally {
      if (!background && requestId === productionRequestIdRef.current) setLoading(false);
    }
  };

  const loadMoreRecords = async () => {
    if (!nextProductionCursor || loadingMoreRecords) return;
    setLoadingMoreRecords(true);
    try {
      const page = await fetchProductionRecords({ cursor: nextProductionCursor });
      setRecords((current) => {
        const ids = new Set(current.map((record) => record.id));
        return [...current, ...page.items.filter((record) => !ids.has(record.id))];
      });
      setNextProductionCursor(page.nextCursor);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Daha fazla kayıt yüklenemedi.'));
    } finally {
      setLoadingMoreRecords(false);
    }
  };

  const fetchDeletedRecords = async (signal) => {
    try {
      setDeletedLoading(true);
      const page = await fetchDeletedProductionRecords({ signal });
      setDeletedRecords(page.items);
      setDeletedError(null);
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') return;
      setDeletedError(getApiErrorMessage(err, 'Silinen kayıtlar alınamadı.'));
      console.error(err);
    } finally {
      setDeletedLoading(false);
    }
  };

  const loadAlarms = async (signal) => {
    try {
      setAlarmLoading(true);
      const page = await fetchAlarms({ signal });
      setAlarms(page.items);
      setAlarmError(null);
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') return;
      setAlarmError(getApiErrorMessage(err, 'Alarmlar alınırken hata oluştu.'));
      console.error(err);
    } finally {
      setAlarmLoading(false);
    }
  };

  const loadWorkOrders = async (signal) => {
    try {
      const page = await fetchWorkOrders({ signal });
      setWorkOrders(page.items);
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') return;
      console.error(err);
    }
  };

  const loadBatches = async (signal) => {
    try {
      const page = await fetchBatches({ signal });
      setBatches(page.items);
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') return;
      console.error(err);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    const controller = new AbortController();
    fetchRecords(controller.signal);
    if (canViewDeleted) fetchDeletedRecords(controller.signal);
    loadAlarms(controller.signal);
    loadWorkOrders(controller.signal);
    loadBatches(controller.signal);
    return () => controller.abort();
  }, [isAuthenticated, canViewDeleted]);

  useNonOverlappingPolling(
    (signal) => fetchRecords(signal, { background: true }),
    {
      enabled: isAuthenticated && autoRefresh,
      intervalMs: 10000,
      runImmediately: false,
    },
  );

  useNonOverlappingPolling(async (signal) => {
    const timestamp = Date.now().toString();
    const random7 = Math.floor(1000000 + Math.random() * 9000000).toString();

    await createProductionRecord({
      urun20liKod: timestamp + random7,
      malzeme12liKod: Math.floor(100000000000 + Math.random() * 900000000000).toString(),
      istasyonAdi: STATIONS[Math.floor(Math.random() * STATIONS.length)],
      kaliteDurumu: Math.random() > 0.15 ? 'OK' : 'NOK',
      uretimTarihi: new Date().toISOString(),
    }, { signal });
    await fetchRecords(signal, { background: true });
  }, {
    enabled: isFactorySimulationActive && canAddRecord,
    intervalMs: 15000,
    runImmediately: false,
  });

  const createTestAlarm = async () => {
    if (!canCreateAlarms) {
      notify('Alarm oluşturma yetkiniz bulunmamaktadır.', 'error');
      return;
    }
    try {
      setAlarmLoading(true);
      const newAlarm = {
        title: 'Test Alarmı - Sensör Uyarısı',
        station: DEFAULT_STATION,
        severity: 'Uyarı',
        description: 'Test amaçlı oluşturulmuş alarm.',
        status: 'Açık',
        time: new Date().toISOString()
      };
      await createAlarm(newAlarm);
      await loadAlarms();
    } catch (err) {
      notify(getApiErrorMessage(err, 'Test alarmı oluşturulurken hata oluştu.'), 'error');
      console.error(err);
    } finally {
      setAlarmLoading(false);
    }
  };

  const createManualAlarm = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!canCreateAlarms) {
      notify('Alarm oluşturma yetkiniz bulunmamaktadır.', 'error');
      return;
    }
    try {
      setAlarmLoading(true);
      const newAlarm = {
        title: manualTitle || 'Manuel Alarm',
        station: manualStation || DEFAULT_STATION,
        severity: manualSeverity || 'Uyarı',
        description: manualDescription || '',
        status: 'Açık',
        time: new Date().toISOString()
      };
      await createAlarm(newAlarm);
      setManualTitle('');
      setManualStation(DEFAULT_STATION);
      setManualSeverity('Uyarı');
      setManualDescription('');
      await loadAlarms();
    } catch (err) {
      notify(getApiErrorMessage(err, 'Manuel alarm eklenirken hata oluştu.'), 'error');
      console.error(err);
    } finally {
      setAlarmLoading(false);
    }
  };

  const generateRandomBarcodes = () => {
    if (!canAddRecord) {
      notify('Kayıt ekleme yetkiniz yok.', 'error');
      return;
    }
    const timestamp = Date.now().toString();
    const random7 = Math.floor(1000000 + Math.random() * 9000000).toString();
    const urunCode = timestamp + random7;
    const random12 = Math.floor(100000000000 + Math.random() * 900000000000).toString();
    const randomStation = STATIONS[Math.floor(Math.random() * STATIONS.length)];
    const randomQuality = Math.random() > 0.15 ? 'OK' : 'NOK';

    setUrun20liKod(urunCode);
    setMalzeme12liKod(random12);
    setIstasyonAdi(randomStation);
    setKaliteDurumu(randomQuality);
  };

  const handleExportExcel = () => {
    const exportData = filteredRecords.length > 0 ? filteredRecords : records;
    if (!exportData || exportData.length === 0) {
      notify("Dışa aktarılacak veri bulunamadı!", 'error');
      return;
    }
    const formattedData = exportData.map((r) => ({
      "Kayıt ID": r.id,
      "20'li Ürün Kodu": r.urun20liKod,
      "12'li Malzeme Kodu": r.malzeme12liKod,
      "İstasyon Adı": r.istasyonAdi,
      "Kalite Durumu": r.kaliteDurumu,
      "Üretim Tarihi": r.uretimTarihi ? new Date(r.uretimTarihi).toLocaleString('tr-TR') : '-'
    }));
    const worksheet = XLSX.utils.json_to_sheet(formattedData);
    worksheet['!cols'] = [
      { wch: 10 }, { wch: 25 }, { wch: 18 }, { wch: 25 }, { wch: 15 }, { wch: 22 }
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Üretim Raporu");
    const tarih = new Date().toLocaleDateString('tr-TR').replace(/\./g, '_');
    XLSX.writeFile(workbook, `Vestel_MES_Uretim_Raporu_${tarih}.xlsx`);
  };

  const handleAddRecord = async (e) => {
    e.preventDefault();
    if (!canAddRecord) {
      notify('Seçili kullanıcı şu anda üretim kaydı ekleyemez.', 'error');
      return;
    }

    try {
      await createProductionRecord({
        urun20liKod,
        malzeme12liKod,
        istasyonAdi: istasyonAdi || DEFAULT_STATION,
        kaliteDurumu,
        uretimTarihi: new Date().toISOString()
      });

      setUrun20liKod('');
      setMalzeme12liKod('');
      setIstasyonAdi('');
      setKaliteDurumu('OK');
      await fetchRecords();
      if (canViewDeleted) await fetchDeletedRecords();
      urunInputRef.current?.focus();
    } catch (err) {
      notify(getApiErrorMessage(err, 'Kayıt eklenirken bir sorun oluştu.'), 'error');
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    if (!canDeleteRecord) {
      notify('Bu işlemi yapmak için Tam Yetki yetkisine sahip olmalısınız.', 'error');
      return;
    }
    if (!(await confirm(`ID: ${id} kaydını silmek istediğinize emin misiniz?`))) return;
    try {
      const res = await deleteProductionRecord(id);
      if (res.success !== false) {
        await fetchRecords();
        if (canViewDeleted) await fetchDeletedRecords();
      } else {
        notify(`Silme Başarısız: ${res.message}`, 'error');
      }
    } catch (err) {
      notify(getApiErrorMessage(err, 'Silme işlemi başarısız.'), 'error');
      console.error(err);
    }
  };

  // --- ALARM SİLME HANDLER ---
  const handleDeleteAlarm = async (alarmOrId) => {
    const id = typeof alarmOrId === 'object' 
      ? (alarmOrId.id ?? alarmOrId.Id ?? alarmOrId.alarmId ?? alarmOrId.AlarmId) 
      : alarmOrId;

    if (!canManageAlarms) {
      notify('Alarm silme yetkiniz bulunmamaktadır.', 'error');
      return;
    }

    if (!id) {
      notify('Hata: Silinecek alarmın ID bilgisi okunamadı!', 'error');
      return;
    }

    if (!(await confirm('Bu alarmı silmek istediğinize emin misiniz?'))) return;
    
    try {
      await deleteAlarm(id);
      await loadAlarms(); // Silme başarılı olunca listeyi yenile
    } catch (err) {
      notify(getApiErrorMessage(err, 'Alarm silinirken hata oluştu.'), 'error');
      console.error(err);
    }
  };

  const handleHardDelete = async (recordOrId) => {
    const id = typeof recordOrId === 'object' ? (recordOrId.id || recordOrId.Id) : recordOrId;

    if (!canHardDelete) {
      notify('Kalıcı silme işlemi için ek yönetici yetkisi gereklidir.', 'error');
      return;
    }

    if (!id) {
      notify('Hata: Silinecek kaydın ID bilgisi okunamadı!', 'error');
      return;
    }

    if (!(await confirm(`ID: ${id} kaydı veritabanından KALICI OLARAK silinecektir. Bu işlem geri alınamaz! Onaylıyor musunuz?`))) return;

    try {
      const res = await hardDeleteProductionRecord(id);
      if (res && res.success !== false) {
        if (canViewDeleted) await fetchDeletedRecords();
      } else {
        notify(`Kalıcı Silme Başarısız: ${res?.message || 'Sunucu hatası'}`, 'error');
      }
    } catch (err) {
      notify(getApiErrorMessage(err, 'Kalıcı silme işlemi başarısız.'), 'error');
      console.error(err);
    }
  };

  const handleRestore = async (recordOrId) => {
    const id = typeof recordOrId === 'object' ? (recordOrId.id || recordOrId.Id) : recordOrId;

    if (!canDeleteRecord) {
      notify('Silinen kaydı geri yüklemek için Tam Yetki gereklidir.', 'error');
      return;
    }

    if (!id) {
      notify('Hata: Geri yüklenecek kaydın ID bilgisi okunamadı!', 'error');
      return;
    }

    try {
      const res = await restoreProductionRecord(id);
      if (res && res.success !== false) {
        await fetchRecords();
        if (canViewDeleted) await fetchDeletedRecords();
      } else {
        notify(`Geri Yükleme Başarısız: ${res?.message || 'Sunucu hatası'}`, 'error');
      }
    } catch (err) {
      notify(getApiErrorMessage(err, 'Geri yükleme işlemi başarısız.'), 'error');
      console.error(err);
    }
  };

  const handleToggleQuality = async (record) => {
    if (!canChangeQuality) {
      notify('Seçili kullanıcı kalite durumunu güncelleyemez.', 'error');
      return;
    }
    const newStatus = record.kaliteDurumu === 'OK' ? 'NOK' : 'OK';
    try {
      const res = await updateProductionRecord(record.id, {
        ...record,
        kaliteDurumu: newStatus
      });
      if (res.success !== false) {
        await fetchRecords();
        if (canViewDeleted) await fetchDeletedRecords();
      } else {
        notify(`Güncelleme Başarısız: ${res.message}`, 'error');
      }
    } catch (err) {
      notify(getApiErrorMessage(err, 'Güncelleme başarısız.'), 'error');
      console.error(err);
    }
  };

  const stationsList = [...new Set(records.map((r) => r.istasyonAdi).filter(Boolean))];
  const stationsFilterOptions = ['Tümü', ...stationsList];
  const stationDetailOptions = stationsList.length > 0 ? stationsList : [DEFAULT_STATION];

  const stationDetailRecords = records.filter((record) => record.istasyonAdi === selectedStationDetail);
  const stationMetrics = {
    total: stationDetailRecords.length,
    ok: stationDetailRecords.filter((record) => record.kaliteDurumu === 'OK').length,
    nok: stationDetailRecords.filter((record) => record.kaliteDurumu === 'NOK').length,
    yield: stationDetailRecords.length > 0
      ? ((stationDetailRecords.filter((record) => record.kaliteDurumu === 'OK').length / stationDetailRecords.length) * 100).toFixed(1)
      : 0,
  };

  const filteredRecords = records.filter((r) => {
    const matchesSearch =
      (r.urun20liKod && r.urun20liKod.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (r.malzeme12liKod && r.malzeme12liKod.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStation = selectedStation === 'Tümü' || r.istasyonAdi === selectedStation;
    const matchesQuality = selectedQuality === 'Tümü' || r.kaliteDurumu === selectedQuality;
    return matchesSearch && matchesStation && matchesQuality;
  });

// Live metrics backend'den gelirse kullan, yoksa kayıtlar üzerinden hesapla
const liveOk = records.liveMetrics?.totalOk ?? records.filter((r) => r.kaliteDurumu === 'OK').length;
const liveNok = records.liveMetrics?.totalNok ?? records.filter((r) => r.kaliteDurumu === 'NOK').length;
const totalCount = records.liveMetrics?.totalProduction ?? (liveOk + liveNok);
const okCount = liveOk;
const nokCount = liveNok;
const yieldRate = totalCount > 0 ? ((okCount / totalCount) * 100).toFixed(1) : 0;

  const qualityChartData = [
    { name: 'OK (Başarılı)', value: okCount, color: '#10b981' },
    { name: 'NOK (Hatalı)', value: nokCount, color: '#ef4444' }
  ];

  const stationChartData = stationsList.map((st) => {
    const stRecords = records.filter((r) => r.istasyonAdi === st);
    return {
      name: st,
      OK: stRecords.filter((r) => r.kaliteDurumu === 'OK').length,
      NOK: stRecords.filter((r) => r.kaliteDurumu === 'NOK').length
    };
  });

  const handleWorkOrderSubmit = async (e) => {
    e.preventDefault();
    if (!canManageWorkOrders) {
      notify('İş emri oluşturma yetkiniz yok (Saha Müdürü yetkisi gereklidir).', 'error');
      return;
    }
    try {
      await createWorkOrder({
      orderNo: workOrderForm.orderNo,
      product: workOrderForm.product,
      station: workOrderForm.station,
      quantity: Number(workOrderForm.quantity),
      });
      setWorkOrderForm({ orderNo: '', product: '', station: '', quantity: '' });
      await loadWorkOrders();
    } catch (err) {
      notify(getApiErrorMessage(err, 'İş emri oluşturulamadı.'), 'error');
      console.error(err);
    }
  };

  const handleAdvanceWorkOrder = async (order) => {
    if (!canManageWorkOrders) {
      notify('İş emri durumunu değiştirme yetkiniz yok.', 'error');
      return;
    }
    try {
      await advanceWorkOrder(order.id, order.rowVersion);
      await loadWorkOrders();
    } catch (err) {
      notify(getApiErrorMessage(err, 'İş emri durumu güncellenemedi.'), 'error');
      console.error(err);
    }
  };

  const handleAcknowledgeAlarm = async (id) => {
    if (!canManageAlarms) {
      notify('Alarm onaylama yetkiniz bulunmamaktadır.', 'error');
      return;
    }
    try {
      await acknowledgeAlarm(id);
      await loadAlarms();
    } catch (err) {
      notify(getApiErrorMessage(err, 'Alarm onayı kaydedilirken hata oluştu.'), 'error');
      console.error(err);
    }
  };

  const handleOpenModal = (record) => {
    setSelectedRecord(record);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedRecord(null);
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
            
            {/* YENİ EKLENEN FABRİKA SİMÜLASYON BUTONU */}
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
                transition: 'all 0.3s ease'
              }}
            >
              <Activity size={16} />
              {isFactorySimulationActive ? '🏭 Simülasyon: ÇALIŞIYOR' : '🏭 Simülasyonu Başlat'}
            </button>

            {/* MEVCUT BUTONLAR */}
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
                fontWeight: 600
              }}
            >
              <RefreshCw size={16} />
              {autoRefresh ? 'Otomatik Yenileme Açık' : 'Otomatik Yenileme Kapalı'}
            </button>
            <button
              type="button"
              onClick={fetchRecords}
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
                color: '#0f172a'
              }}
            >
              <RefreshCw size={16} />
              Yenile
            </button>
            <div className="user-badge" style={{ minWidth: '220px' }}>
              <div className="status-dot" style={{ backgroundColor: isCurrentUserActive ? '#10b981' : '#ef4444' }}></div>
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
          {/* 📊 ÜRETİM PANESİ */}
          <Route path="/dashboard" element={
            <DashboardPage
              metrics={{ totalCount, okCount, nokCount, yieldRate, qualityChartData }}
              permission={{ isActive: isCurrentUserActive, text: permissionText }}
              form={{
                urun20liKod,
                malzeme12liKod,
                istasyonAdi,
                kaliteDurumu,
                onChangeUrun: (event) => setUrun20liKod(event.target.value),
                onChangeMalzeme: (event) => setMalzeme12liKod(event.target.value),
                onChangeStation: (event) => setIstasyonAdi(event.target.value),
                onChangeQuality: (event) => setKaliteDurumu(event.target.value),
                onSubmit: handleAddRecord,
                onGenerateRandom: generateRandomBarcodes,
                urunInputRef,
                malzemeInputRef,
                canSubmit: canAddRecord,
              }}
              table={{
                records,
                loading,
                error,
                filteredRecords,
                searchTerm,
                selectedStation,
                selectedQuality,
                stationsFilterOptions,
                onSearchChange: (event) => setSearchTerm(event.target.value),
                onStationChange: (event) => setSelectedStation(event.target.value),
                onQualityChange: (event) => setSelectedQuality(event.target.value),
                onExportExcel: handleExportExcel,
                onToggleQuality: canChangeQuality ? handleToggleQuality : undefined,
                canChangeQuality,
                canDeleteRecord,
                onDelete: canDeleteRecord ? handleDelete : undefined,
                onOpenDetail: handleOpenModal,
              }}
              pagination={{
                hasMore: Boolean(nextProductionCursor),
                loadMore: loadMoreRecords,
                loading: loadingMoreRecords,
              }}
            />
          } />

          <Route path="/makine-metrikleri" element={<MachineMetricsPanel />} />


          {/* 🛠️ İSTASYONLAR SEKMESİ */}
          <Route path="/istasyonlar" element={
            <StationsPage
              stationChartData={stationChartData}
              stationDetailOptions={stationDetailOptions}
              selectedStation={selectedStationDetail}
              onStationChange={(event) => setSelectedStationDetail(event.target.value)}
              stationMetrics={stationMetrics}
              recentRecords={stationDetailRecords.slice(0, 4)}
              stations={stationsList}
              records={records}
            />
          } />

          {/* 📋 KALİTE VE RAPORLAR SEKMESİ */}
          <Route path="/kalite" element={
            <QualityPage
              workOrders={{ items: workOrders, onAdvance: handleAdvanceWorkOrder }}
              alarms={{
                items: alarms,
                loading: alarmLoading,
                error: alarmError,
                onCreateTest: createTestAlarm,
                onAcknowledge: handleAcknowledgeAlarm,
                onDelete: handleDeleteAlarm,
              }}
              batches={batches}
              deleted={{
                items: deletedRecords,
                loading: deletedLoading,
                error: deletedError,
                onRestore: handleRestore,
                onHardDelete: canHardDelete ? handleHardDelete : undefined,
              }}
              production={{ records, onToggleQuality: handleToggleQuality, onDelete: handleDelete }}
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
              alarmForm={{
                title: manualTitle,
                station: manualStation,
                severity: manualSeverity,
                description: manualDescription,
                onTitleChange: (event) => setManualTitle(event.target.value),
                onStationChange: (event) => setManualStation(event.target.value),
                onSeverityChange: (event) => setManualSeverity(event.target.value),
                onDescriptionChange: (event) => setManualDescription(event.target.value),
                onSubmit: createManualAlarm,
              }}
              workOrderForm={{
                values: workOrderForm,
                onFieldChange: (field, value) => setWorkOrderForm((current) => ({ ...current, [field]: value })),
                onSubmit: handleWorkOrderSubmit,
                onDenied: (event) => {
                  event?.preventDefault();
                  notify('Bu işlem için yetkiniz yok.', 'error');
                },
              }}
            />
          } />

          {/* Varsayılan Yönlendirmeler */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>

      <DetailModal record={selectedRecord} isOpen={isModalOpen} onClose={handleCloseModal} />
    </div>
  );
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
