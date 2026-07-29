import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell, 
  PieChart, 
  Pie, 
  Legend 
} from 'recharts';
import { 
  Factory, 
  Activity,
  CheckCircle2, 
  XCircle, 
  Percent, 
  LayoutDashboard,
  Cpu,
  AlertTriangle,
  PieChart as PieIcon,
  BarChart3,
  RefreshCw,
  Trash2,
  Lock,
  LogOut
} from 'lucide-react';

import './App.css';
import { useAuth } from './context/AuthContext';
import {
  createProductionRecord,
  deleteProductionRecord,
  fetchProductionRecords,
  fetchDeletedProductionRecords,
  fetchAlarms,
  acknowledgeAlarm,
  createAlarm,
  restoreProductionRecord,
  updateProductionRecord,
  fetchWorkOrders,
  createWorkOrder,
  advanceWorkOrder
} from './services/api';

import KpiCard from './components/KpiCard';
import ProductionForm from './components/ProductionForm';
import ProductionTable from './components/ProductionTable';
import StationDetailPanel from './components/StationDetailPanel';
import WorkOrderBoard from './components/WorkOrderBoard';
import AlarmPanel from './components/AlarmPanel';
import TraceabilityPanel from './components/TraceabilityPanel';
import UserRolePanel from './components/UserRolePanel';
import DetailModal from './components/DetailModal';
import LoginPage from './pages/LoginPage';

function MainLayout() {
  const { users, activeUserId, setActiveUserId, currentUser, logout, isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const [records, setRecords] = useState([]);
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

  // Filtreleme
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStation, setSelectedStation] = useState('Tümü');
  const [selectedQuality, setSelectedQuality] = useState('Tümü');
  const [selectedStationDetail, setSelectedStationDetail] = useState('Montaj_Hatti_01');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  
  const [workOrders, setWorkOrders] = useState([
    { id: 1, orderNo: 'WO-1001', product: 'TV Panel', station: 'Montaj_Hatti_01', quantity: 120, status: 'Devam Ediyor' },
    { id: 2, orderNo: 'WO-1002', product: 'Ana Kart', station: 'SMT_Dizgi_Hatti_01', quantity: 80, status: 'Bekliyor' },
  ]);
  const [workOrderForm, setWorkOrderForm] = useState({ orderNo: '', product: '', station: '', quantity: '' });
  const [alarms, setAlarms] = useState([]);
  const [batches] = useState([
    { id: 1, lotNo: 'LOT-24001', product: 'TV Panel', station: 'Montaj_Hatti_01', status: 'Tamamlandı', updatedAt: '08:40' },
    { id: 2, lotNo: 'LOT-24002', product: 'Ana Kart', station: 'SMT_Dizgi_Hatti_01', status: 'İşlemde', updatedAt: '08:25' },
  ]);

  // Manuel alarm form state
  const [manualTitle, setManualTitle] = useState('');
  const [manualStation, setManualStation] = useState('Montaj_Hatti_01');
  const [manualSeverity, setManualSeverity] = useState('Uyarı');
  const [manualDescription, setManualDescription] = useState('');

  // ==========================================
  // 🎯 KESİN ROL VE YETKİ KONTROLLERİ
  // ==========================================
  const isCurrentUserActive = currentUser?.status === 'Aktif';

  // 1. Üretim Kaydı Ekleme (Aktif + Operatör veya Tam Yetki)
  const canAddRecord = isCurrentUserActive && ['Üretim Girişi', 'Tam Yetki'].includes(currentUser.permission);

  // 2. Kalite Durumu Değiştirme (Aktif + Kalite Onayı veya Tam Yetki)
  const canChangeQuality = isCurrentUserActive && ['Kalite Onayı', 'Tam Yetki'].includes(currentUser.permission);

  // 3. Kayıt Silme ve Geri Yükleme (Aktif + Tam Yetki)
  const canDeleteRecord = isCurrentUserActive && currentUser.permission === 'Tam Yetki';

  // 4. Raporları Görüntüleme (Aktif + Kalite, Saha Müdürü, Bakım)
  const canViewReports = isCurrentUserActive && ['Kalite', 'Saha Müdürü', 'Bakım'].includes(currentUser.role);

  // 5. İş Emri Yönetimi (Aktif + Saha Müdürü / Tam Yetki)
  const canManageWorkOrders = isCurrentUserActive && (currentUser.role === 'Saha Müdürü' || currentUser.permission === 'Tam Yetki');

  // 6. Alarm Oluşturma ve Onaylama (Aktif + Kalite veya Saha Müdürü)
  const canManageAlarms = isCurrentUserActive && ['Kalite', 'Saha Müdürü'].includes(currentUser.role);

  // 7. Kullanıcı Rol Yönetimi (Aktif + Saha Müdürü)
  const canManageUsers = isCurrentUserActive && currentUser.role === 'Saha Müdürü';

  const permissionText = !isCurrentUserActive 
    ? 'Kullanıcınız PASİF durumdadır. İşlem yapamazsınız.'
    : canAddRecord && canChangeQuality
    ? 'Tüm üretim ve kalite işlemlerini yapabilirsiniz.'
    : canAddRecord
    ? 'Sadece üretim kayıtları ekleyebilirsiniz.'
    : canChangeQuality
    ? 'Sadece kalite durumlarını güncelleyebilirsiniz.'
    : 'Yalnızca raporları görüntüleyebilirsiniz.';

  const rolePermissionDefaults = {
    'Operatör': 'Üretim Girişi',
    'Kalite': 'Kalite Onayı',
    'Saha Müdürü': 'Tam Yetki',
    'Bakım': 'Rapor Görüntüleme'
  };

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const data = await fetchProductionRecords();
      setRecords(Array.isArray(data) ? data.filter((r) => !(r?.isDeleted ?? r?.IsDeleted ?? false)) : []);
      setError(null);
    } catch (err) {
      setError('API bağlantısı başarısız oldu.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDeletedRecords = async () => {
    try {
      setDeletedLoading(true);
      const data = await fetchDeletedProductionRecords();
      setDeletedRecords(Array.isArray(data) ? data.filter((r) => (r?.isDeleted ?? r?.IsDeleted ?? false)) : []);
      setDeletedError(null);
    } catch (err) {
      setDeletedError('Silinen kayıtlar alınamadı.');
      console.error(err);
    } finally {
      setDeletedLoading(false);
    }
  };

  const loadAlarms = async () => {
    try {
      setAlarmLoading(true);
      const data = await fetchAlarms();
      setAlarms(Array.isArray(data) ? data : []);
      setAlarmError(null);
    } catch (err) {
      setAlarmError('Alarmlar alınırken hata oluştu.');
      console.error(err);
    } finally {
      setAlarmLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
    fetchDeletedRecords();
    loadAlarms();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = window.setInterval(() => {
      fetchRecords();
    }, 10000);
    return () => window.clearInterval(interval);
  }, [autoRefresh]);

  const createTestAlarm = async () => {
    if (!canManageAlarms) {
      alert('Alarm oluşturma yetkiniz bulunmamaktadır.');
      return;
    }
    try {
      setAlarmLoading(true);
      const newAlarm = {
        title: 'Test Alarmı - Sensör Uyarısı',
        station: 'Montaj_Hatti_01',
        severity: 'Uyarı',
        description: 'Test amaçlı oluşturulmuş alarm.',
        status: 'Açık',
        time: new Date().toISOString()
      };
      await createAlarm(newAlarm);
      await loadAlarms();
    } catch (err) {
      alert('Test alarmı oluşturulurken hata oluştu.');
      console.error(err);
    } finally {
      setAlarmLoading(false);
    }
  };

  const createManualAlarm = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!canManageAlarms) {
      alert('Alarm oluşturma yetkiniz bulunmamaktadır.');
      return;
    }
    try {
      setAlarmLoading(true);
      const newAlarm = {
        title: manualTitle || 'Manuel Alarm',
        station: manualStation || 'Montaj_Hatti_01',
        severity: manualSeverity || 'Uyarı',
        description: manualDescription || '',
        status: 'Açık',
        time: new Date().toISOString()
      };
      await createAlarm(newAlarm);
      setManualTitle('');
      setManualStation('Montaj_Hatti_01');
      setManualSeverity('Uyarı');
      setManualDescription('');
      await loadAlarms();
    } catch (err) {
      alert('Manuel alarm eklenirken hata oluştu.');
      console.error(err);
    } finally {
      setAlarmLoading(false);
    }
  };

  const generateRandomBarcodes = () => {
    if (!canAddRecord) {
      alert('Kayıt ekleme yetkiniz yok.');
      return;
    }
    const timestamp = Date.now().toString();
    const random7 = Math.floor(1000000 + Math.random() * 9000000).toString();
    const urunCode = timestamp + random7;
    const random12 = Math.floor(100000000000 + Math.random() * 900000000000).toString();
    const sampleStations = [
      'Montaj_Hatti_01',
      'Test_Ve_Paketleme_Istasyonu',
      'Montaj_Hatti_02',
      'Montaj_3',
      'Havuz_1',
      'SMT_Dizgi_Hatti_01',
      'Kalite_Kontrol_Noktasi'
    ];
    const randomStation = sampleStations[Math.floor(Math.random() * sampleStations.length)];
    const randomQuality = Math.random() > 0.15 ? 'OK' : 'NOK';

    setUrun20liKod(urunCode);
    setMalzeme12liKod(random12);
    setIstasyonAdi(randomStation);
    setKaliteDurumu(randomQuality);
  };

  const handleExportExcel = () => {
    const exportData = filteredRecords.length > 0 ? filteredRecords : records;
    if (!exportData || exportData.length === 0) {
      alert("Dışa aktarılacak veri bulunamadı!");
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
      alert('Seçili kullanıcı şu anda üretim kaydı ekleyemez.');
      return;
    }
    if (urun20liKod.length !== 20 || isNaN(urun20liKod)) {
      alert("Hata: 20'li Ürün Kodu tam 20 haneli sayı olmalıdır!");
      urunInputRef.current?.focus();
      return;
    }
    if (malzeme12liKod.length !== 12 || isNaN(malzeme12liKod)) {
      alert("Hata: 12'li Malzeme Kodu tam 12 haneli sayı olmalıdır!");
      malzemeInputRef.current?.focus();
      return;
    }
    try {
      await createProductionRecord({
        urun20liKod,
        malzeme12liKod,
        istasyonAdi: istasyonAdi || 'Montaj_Hatti_01',
        kaliteDurumu,
        uretimTarihi: new Date().toISOString()
      });
      setUrun20liKod('');
      setMalzeme12liKod('');
      setIstasyonAdi('');
      setKaliteDurumu('OK');
      await fetchRecords();
      await fetchDeletedRecords();
      urunInputRef.current?.focus();
    } catch (err) {
      alert('Kayıt eklenirken hata oluştu!');
    }
  };

  const handleDelete = async (id) => {
    if (!canDeleteRecord) {
      alert('Bu işlemi yapmak için Tam Yetki yetkisine sahip olmalısınız.');
      return;
    }
    if (!window.confirm(`ID: ${id} kaydını silmek istediğinize emin misiniz?`)) return;
    try {
      await deleteProductionRecord(id);
      await fetchRecords();
      await fetchDeletedRecords();
    } catch (err) {
      alert('Silme işlemi başarısız!');
    }
  };

  const handleRestore = async (id) => {
    if (!canDeleteRecord) {
      alert('Silinen kaydı geri yüklemek için Tam Yetki gereklidir.');
      return;
    }
    try {
      await restoreProductionRecord(id);
      await fetchRecords();
      await fetchDeletedRecords();
    } catch (err) {
      alert('Geri yükleme işlemi başarısız!');
    }
  };

  const handleToggleQuality = async (record) => {
    if (!canChangeQuality) {
      alert('Seçili kullanıcı kalite durumunu güncelleyemez.');
      return;
    }
    const newStatus = record.kaliteDurumu === 'OK' ? 'NOK' : 'OK';
    try {
      await updateProductionRecord(record.id, {
        ...record,
        kaliteDurumu: newStatus
      });
      await fetchRecords();
      await fetchDeletedRecords();
    } catch (err) {
      alert('Güncelleme başarısız!');
    }
  };

  const stationsList = [...new Set(records.map((r) => r.istasyonAdi).filter(Boolean))];
  const stationsFilterOptions = ['Tümü', ...stationsList];
  const stationDetailOptions = stationsList.length > 0 ? stationsList : ['Montaj_Hatti_01'];

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

  const totalCount = records.length;
  const okCount = records.filter((r) => r.kaliteDurumu === 'OK').length;
  const nokCount = records.filter((r) => r.kaliteDurumu === 'NOK').length;
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

  const handleWorkOrderSubmit = (e) => {
    e.preventDefault();
    if (!canManageWorkOrders) {
      alert('İş emri oluşturma yetkiniz yok (Saha Müdürü yetkisi gereklidir).');
      return;
    }
    const newOrder = {
      id: Date.now(),
      orderNo: workOrderForm.orderNo,
      product: workOrderForm.product,
      station: workOrderForm.station,
      quantity: workOrderForm.quantity,
      status: 'Bekliyor',
    };
    setWorkOrders((prev) => [newOrder, ...prev]);
    setWorkOrderForm({ orderNo: '', product: '', station: '', quantity: '' });
  };

  const handleAdvanceWorkOrder = (id) => {
    if (!canManageWorkOrders) {
      alert('İş emri durumunu değiştirme yetkiniz yok.');
      return;
    }
    setWorkOrders((prev) => prev.map((order) => {
      if (order.id !== id) return order;
      if (order.status === 'Bekliyor') return { ...order, status: 'Devam Ediyor' };
      if (order.status === 'Devam Ediyor') return { ...order, status: 'Tamamlandı' };
      return order;
    }));
  };

  const handleAcknowledgeAlarm = async (id) => {
    if (!canManageAlarms) {
      alert('Alarm onaylama yetkiniz bulunmamaktadır.');
      return;
    }
    try {
      await acknowledgeAlarm(id);
      await loadAlarms();
    } catch (err) {
      alert('Alarm onayı kaydedilirken hata oluştu.');
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

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="brand">
          <Factory className="brand-icon" size={28} />
          <span>VESTEL MES</span>
        </div>
        <ul className="menu-list">
          <li className={`menu-item ${isDashboardActive ? 'active' : ''}`}>
            <Link to="/dashboard" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
              <LayoutDashboard size={20} />
              <span>Üretim Paneli</span>
            </Link>
          </li>
          <li className={`menu-item ${isStationsActive ? 'active' : ''}`}>
            <Link to="/istasyonlar" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
              <Cpu size={20} />
              <span>İstasyonlar</span>
            </Link>
          </li>
          <li className={`menu-item ${isQualityActive ? 'active' : ''}`}>
            <Link to="/kalite" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
              <Activity size={20} />
              <span>Kalite Raporları</span>
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
            </h1>
            <p>Saha Canlı Akış Verileri ve İstasyon Yönetimi</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
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
            <select
              className="input-field"
              value={activeUserId}
              onChange={(e) => setActiveUserId(Number(e.target.value))}
              style={{ minWidth: '180px', background: '#fff' }}
            >
              {users.map((user) => (
                <option key={user.id} value={user.id}>{user.name} - {user.role} ({user.status})</option>
              ))}
            </select>
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
            <>
              <section className="kpi-grid">
                <KpiCard title="Toplam Üretim" value={totalCount} icon={Activity} accent={{ bg: '#e0f2fe', color: '#0284c7' }} />
                <KpiCard title="Başarılı (OK)" value={okCount} icon={CheckCircle2} accent={{ bg: '#d1fae5', color: '#10b981' }} valueColor="#10b981" />
                <KpiCard title="Hatalı (NOK)" value={nokCount} icon={XCircle} accent={{ bg: '#fee2e2', color: '#ef4444' }} valueColor="#ef4444" />
                <KpiCard title="Verimlilik Oranı" value={`%${yieldRate}`} icon={Percent} accent={{ bg: '#fef3c7', color: '#f59e0b' }} valueColor="#f59e0b" />
              </section>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                <div className="custom-card" style={{ marginBottom: 0, borderLeft: !isCurrentUserActive ? '5px solid #ef4444' : '5px solid #0284c7' }}>
                  <div className="card-header">
                    <span>Aktif Kullanıcı Yetkisi</span>
                  </div>
                  <p style={{ margin: 0, color: !isCurrentUserActive ? '#ef4444' : '#475569', fontWeight: !isCurrentUserActive ? 600 : 400 }}>
                    {permissionText}
                  </p>
                </div>

                <ProductionForm
                  urun20liKod={urun20liKod}
                  malzeme12liKod={malzeme12liKod}
                  istasyonAdi={istasyonAdi}
                  kaliteDurumu={kaliteDurumu}
                  onChangeUrun={(e) => setUrun20liKod(e.target.value)}
                  onChangeMalzeme={(e) => setMalzeme12liKod(e.target.value)}
                  onChangeStation={(e) => setIstasyonAdi(e.target.value)}
                  onChangeQuality={(e) => setKaliteDurumu(e.target.value)}
                  onSubmit={handleAddRecord}
                  onGenerateRandom={generateRandomBarcodes}
                  urunInputRef={urunInputRef}
                  malzemeInputRef={malzemeInputRef}
                  canSubmit={canAddRecord}
                />

                <section className="custom-card" style={{ marginBottom: 0, display: 'flex', flexDirection: 'column' }}>
                  <div className="card-header">
                    <PieIcon className="text-primary" size={20} />
                    <span>Kalite Dağılım Grafiği</span>
                  </div>
                  <div style={{ flex: 1, minHeight: '260px', width: '100%' }}>
                    {totalCount === 0 ? (
                      <p style={{ textAlign: 'center', paddingTop: '80px', color: '#94a3b8' }}>Grafik için henüz veri yok.</p>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={qualityChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {qualityChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(val) => [`${val} Adet`, 'Miktar']} />
                          <Legend verticalAlign="bottom" height={36} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </section>
              </div>

              <ProductionTable
                records={records}
                loading={loading}
                error={error}
                filteredRecords={filteredRecords}
                searchTerm={searchTerm}
                selectedStation={selectedStation}
                selectedQuality={selectedQuality}
                stationsFilterOptions={stationsFilterOptions}
                onSearchChange={(e) => setSearchTerm(e.target.value)}
                onStationChange={(e) => setSelectedStation(e.target.value)}
                onQualityChange={(e) => setSelectedQuality(e.target.value)}
                onExportExcel={handleExportExcel}
                onToggleQuality={canChangeQuality ? handleToggleQuality : undefined}
                canChangeQuality={canChangeQuality}
                canDeleteRecord={canDeleteRecord}
                onDelete={canDeleteRecord ? handleDelete : undefined}
                onOpenDetail={handleOpenModal}
              />
            </>
          } />

          {/* 🛠️ İSTASYONLAR SEKMESİ */}
          <Route path="/istasyonlar" element={
            <>
              <section className="custom-card">
                <div className="card-header">
                  <BarChart3 className="text-primary" size={20} />
                  <span>İstasyon Bazlı Üretim Hacmi Analizi</span>
                </div>
                <div style={{ width: '100%', height: '380px' }}>
                  {stationChartData.length === 0 ? (
                    <p style={{ textAlign: 'center', paddingTop: '100px', color: '#94a3b8' }}>Grafik verisi bulunamadı.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stationChartData} margin={{ top: 20, right: 30, left: 0, bottom: 80 }}>
                        <XAxis dataKey="name" interval={0} angle={-35} textAnchor="end" tick={{ fontSize: 11, fill: '#475569' }} />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Legend verticalAlign="top" height={36} />
                        <Bar dataKey="OK" fill="#10b981" name="Başarılı (OK)" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="NOK" fill="#ef4444" name="Hatalı (NOK)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </section>

              <StationDetailPanel
                stationsList={stationDetailOptions}
                selectedStation={selectedStationDetail}
                onStationChange={(e) => setSelectedStationDetail(e.target.value)}
                stationMetrics={stationMetrics}
                recentRecords={stationDetailRecords.slice(0, 4)}
              />

              <section className="custom-card">
                <div className="card-header">
                  <Cpu className="text-primary" size={20} />
                  <span>Saha İstasyon Performansı ve İş Yükü</span>
                </div>
                
                <div className="table-wrapper">
                  <table className="modern-table">
                    <thead>
                      <tr>
                        <th>İstasyon Adı</th>
                        <th>Toplam İşlenen Ürün</th>
                        <th>Başarılı (OK)</th>
                        <th>Hatalı (NOK)</th>
                        <th>İstasyon Verimliliği</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stationsList.length === 0 ? (
                        <tr>
                          <td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>Veri bulunamadı.</td>
                        </tr>
                      ) : (
                        stationsList.map((stName, idx) => {
                          const stRecords = records.filter((r) => r.istasyonAdi === stName);
                          const stTotal = stRecords.length;
                          const stOk = stRecords.filter((r) => r.kaliteDurumu === 'OK').length;
                          const stNok = stRecords.filter((r) => r.kaliteDurumu === 'NOK').length;
                          const stRate = stTotal > 0 ? ((stOk / stTotal) * 100).toFixed(1) : 0;

                          return (
                            <tr key={idx}>
                              <td><b>{stName}</b></td>
                              <td>{stTotal} adet</td>
                              <td style={{ color: '#10b981', fontWeight: 'bold' }}>{stOk}</td>
                              <td style={{ color: '#ef4444', fontWeight: 'bold' }}>{stNok}</td>
                              <td>
                                <span 
                                  className="badge" 
                                  style={{ 
                                    backgroundColor: stRate >= 80 ? '#d1fae5' : '#fef3c7', 
                                    color: stRate >= 80 ? '#065f46' : '#b45309' 
                                  }}
                                >
                                  %{stRate}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          } />

          {/* 📋 KALİTE VE RAPORLAR SEKMESİ */}
          <Route path="/kalite" element={
            <>
              {/* İş emri takip formu yetki durumu verilerek çağrılıyor */}
              <WorkOrderBoard
                workOrders={workOrders}
                formValues={workOrderForm}
                onFieldChange={(field, value) => setWorkOrderForm((prev) => ({ ...prev, [field]: value }))}
                onSubmit={canManageWorkOrders ? handleWorkOrderSubmit : (e) => { e.preventDefault(); alert('Yetkiniz yok!'); }}
                onAdvance={canManageWorkOrders ? handleAdvanceWorkOrder : () => alert('Yetkiniz yok!')}
                disabled={!canManageWorkOrders}
              />

              {canViewReports ? (
                <>
                  {canManageAlarms && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
                      <button
                        type="button"
                        className="btn-primary"
                        style={{ minWidth: '200px', padding: '10px 16px' }}
                        onClick={createTestAlarm}
                        disabled={alarmLoading}
                      >
                        {alarmLoading ? 'Alarm oluşturuluyor...' : 'Test Alarmı Oluştur'}
                      </button>
                      <form onSubmit={createManualAlarm} style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <input
                          placeholder="Başlık"
                          value={manualTitle}
                          onChange={(e) => setManualTitle(e.target.value)}
                          className="input-field"
                          style={{ minWidth: '180px' }}
                        />
                        <select value={manualStation} onChange={(e) => setManualStation(e.target.value)} className="input-field">
                          <option>Montaj_Hatti_01</option>
                          <option>Montaj_Hatti_02</option>
                          <option>Test_Ve_Paketleme_Istasyonu</option>
                          <option>SMT_Dizgi_Hatti_01</option>
                          <option>Kalite_Kontrol_Noktasi</option>
                        </select>
                        <select value={manualSeverity} onChange={(e) => setManualSeverity(e.target.value)} className="input-field">
                          <option>Uyarı</option>
                          <option>Düşük</option>
                          <option>Yüksek</option>
                          <option>Kritik</option>
                        </select>
                        <input
                          placeholder="Açıklama (isteğe bağlı)"
                          value={manualDescription}
                          onChange={(e) => setManualDescription(e.target.value)}
                          className="input-field"
                          style={{ minWidth: '220px' }}
                        />
                        <button type="submit" className="btn-primary" disabled={alarmLoading} style={{ padding: '8px 12px' }}>
                          {alarmLoading ? 'Ekleniyor...' : 'Manuel Alarm Ekle'}
                        </button>
                      </form>
                      {alarmError && <span className="error" style={{ marginLeft: 'auto' }}>{alarmError}</span>}
                    </div>
                  )}

                  <AlarmPanel alarms={alarms} onAcknowledge={canManageAlarms ? handleAcknowledgeAlarm : undefined} />
                  <TraceabilityPanel batches={batches} />
                </>
              ) : (
                <section className="custom-card" style={{ borderLeft: '5px solid #f59e0b' }}>
                  <div className="card-header" style={{ color: '#f59e0b' }}>
                    <Lock size={20} />
                    <span>Rapor Görüntüleme Yetkiniz Yok</span>
                  </div>
                  <p style={{ margin: 0, color: '#475569' }}>
                    Seçili kullanıcı rolü, kalite ve saha raporlarını görüntüleme yetkisine sahip değildir.
                  </p>
                </section>
              )}

              {canManageUsers && (
                <UserRolePanel
                  users={users}
                  activeUserId={activeUserId}
                  onUpdateUser={(id, field, value) => {
                    const updated = users.map((u) => {
                      if (u.id !== id) return u;
                      if (field === 'role') {
                        return { ...u, role: value, permission: rolePermissionDefaults[value] || u.permission };
                      }
                      return { ...u, [field]: value };
                    });
                    localStorage.setItem('mm_users', JSON.stringify(updated));
                    window.location.reload();
                  }}
                  onToggleUserStatus={(id) => {
                    const updated = users.map((u) => u.id === id ? { ...u, status: u.status === 'Aktif' ? 'Pasif' : 'Aktif' } : u);
                    localStorage.setItem('mm_users', JSON.stringify(updated));
                    window.location.reload();
                  }}
                  onSetActiveUser={(id) => setActiveUserId(id)}
                />
              )}

              <section className="custom-card">
                <div className="card-header" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <RefreshCw className="text-primary" size={20} />
                    <span>Çöp Kutusu / Silinen Kayıtlar</span>
                  </div>
                  <span style={{ color: '#64748b', fontSize: '0.9rem' }}>{deletedRecords.length} adet silinmiş kayıt</span>
                </div>

                <div className="table-wrapper">
                  {deletedLoading && <p>Silinen kayıtlar yükleniyor...</p>}
                  {deletedError && <p className="error">{deletedError}</p>}
                  {!deletedLoading && !deletedError && (
                    <table className="modern-table">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>20'li Ürün Kodu</th>
                          <th>12'li Malzeme Kodu</th>
                          <th>İstasyon Adı</th>
                          <th>Silinme Tarihi</th>
                          <th>Aksiyon</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deletedRecords.length === 0 ? (
                          <tr>
                            <td colSpan="6" style={{ textAlign: 'center', padding: '30px' }}>
                              Çöp kutusunda henüz kayıt yok.
                            </td>
                          </tr>
                        ) : (
                          deletedRecords.map((r) => (
                            <tr key={r.id}>
                              <td><b>#{r.id}</b></td>
                              <td><code style={{ background: '#f1f5f9', padding: '4px 8px', borderRadius: '4px' }}>{r.urun20liKod}</code></td>
                              <td><code style={{ background: '#f1f5f9', padding: '4px 8px', borderRadius: '4px' }}>{r.malzeme12liKod}</code></td>
                              <td>{r.istasyonAdi}</td>
                              <td>{r.uretimTarihi ? new Date(r.uretimTarihi).toLocaleString('tr-TR') : '-'}</td>
                              <td>
                                {canDeleteRecord ? (
                                  <button
                                    type="button"
                                    className="btn-primary"
                                    onClick={() => handleRestore(r.id)}
                                    style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                                  >
                                    <RefreshCw size={16} />
                                    Geri Yükle
                                  </button>
                                ) : (
                                  <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Yetki Yok</span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              </section>

              <section className="custom-card" style={{ borderLeft: '5px solid #ef4444' }}>
                <div className="card-header" style={{ color: '#ef4444' }}>
                  <AlertTriangle size={20} />
                  <span>Kalite Kontrol Alarm & Hata Özeti</span>
                </div>
                <p style={{ color: '#64748b', margin: 0 }}>
                  Aşağıdaki tabloda üretim hattında <b>NOK (Hatalı)</b> olarak işaretlenmiş tüm ürünler listelenmektedir.
                </p>
              </section>

              <section className="custom-card">
                <div className="card-header">
                  <XCircle style={{ color: '#ef4444' }} size={20} />
                  <span>Hatalı Ürün Listesi (NOK) ({records.filter(r => r.kaliteDurumu === 'NOK').length})</span>
                </div>

                <div className="table-wrapper">
                  <table className="modern-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>20'li Ürün Kodu</th>
                        <th>12'li Malzeme Kodu</th>
                        <th>Hatalı İstasyon</th>
                        <th>Durum</th>
                        <th>Aksiyon</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.filter((r) => r.kaliteDurumu === 'NOK').length === 0 ? (
                        <tr>
                          <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: '#10b981', fontWeight: 'bold' }}>
                            Harika! Şu anda sistemde hatalı (NOK) kayıt bulunmuyor. 🎉
                          </td>
                        </tr>
                      ) : (
                        records.filter((r) => r.kaliteDurumu === 'NOK').map((r) => (
                          <tr key={r.id}>
                            <td><b>#{r.id}</b></td>
                            <td><code style={{ background: '#fee2e2', color: '#991b1b', padding: '4px 8px', borderRadius: '4px' }}>{r.urun20liKod}</code></td>
                            <td><code style={{ background: '#f1f5f9', padding: '4px 8px', borderRadius: '4px' }}>{r.malzeme12liKod}</code></td>
                            <td>{r.istasyonAdi}</td>
                            <td>
                              <span
                                onClick={canChangeQuality ? () => handleToggleQuality(r) : undefined}
                                className="badge badge-nok"
                                title={canChangeQuality ? "Tıkla ve OK Yap" : "Yetkiniz Yok"}
                                style={{ cursor: canChangeQuality ? 'pointer' : 'not-allowed', opacity: canChangeQuality ? 1 : 0.6 }}
                              >
                                <XCircle size={14} />
                                {r.kaliteDurumu}
                              </span>
                            </td>
                            <td>
                              {canDeleteRecord ? (
                                <button
                                  onClick={() => handleDelete(r.id)}
                                  className="btn-delete"
                                  title="Kaydı Sil"
                                >
                                  <Trash2 size={18} />
                                </button>
                              ) : (
                                <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Yetki Yok</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
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