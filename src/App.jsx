import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
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
  PlusCircle, 
  Filter, 
  Trash2, 
  Search,
  LayoutDashboard,
  Cpu,
  AlertTriangle,
  FileSpreadsheet,
  PieChart as PieIcon,
  BarChart3,
  Scan
} from 'lucide-react';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  const API_URL = 'https://localhost:44329/api/Uretim';

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const response = await axios.get(API_URL);
      setRecords(response.data);
      setError(null);
    } catch (err) {
      setError('API bağlantısı başarısız oldu.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  // ⚡ Test Verisi Üreteci (6-7 İstasyonlu)
  const generateRandomBarcodes = () => {
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

  // 📊 Excel Dışa Aktarma
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
      await axios.post(API_URL, {
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
      
      fetchRecords();
      urunInputRef.current?.focus();
    } catch (err) {
      alert('Kayıt eklenirken hata oluştu!');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(`ID: ${id} kaydını silmek istediğinize emin misiniz?`)) return;

    try {
      await axios.delete(`${API_URL}/${id}`);
      fetchRecords();
    } catch (err) {
      alert('Silme işlemi başarısız!');
    }
  };

  const handleToggleQuality = async (record) => {
    const newStatus = record.kaliteDurumu === 'OK' ? 'NOK' : 'OK';
    try {
      await axios.put(`${API_URL}/${record.id}`, {
        ...record,
        kaliteDurumu: newStatus
      });
      fetchRecords();
    } catch (err) {
      alert('Güncelleme başarısız!');
    }
  };

  const stationsList = [...new Set(records.map((r) => r.istasyonAdi).filter(Boolean))];
  const stationsFilterOptions = ['Tümü', ...stationsList];

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

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="brand">
          <Factory className="brand-icon" size={28} />
          <span>VESTEL MES</span>
        </div>
        <ul className="menu-list">
          <li 
            className={`menu-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <LayoutDashboard size={20} />
            <span>Üretim Paneli</span>
          </li>
          <li 
            className={`menu-item ${activeTab === 'stations' ? 'active' : ''}`}
            onClick={() => setActiveTab('stations')}
          >
            <Cpu size={20} />
            <span>İstasyonlar</span>
          </li>
          <li 
            className={`menu-item ${activeTab === 'quality' ? 'active' : ''}`}
            onClick={() => setActiveTab('quality')}
          >
            <Activity size={20} />
            <span>Kalite Raporları</span>
          </li>
        </ul>
      </aside>

      <main className="main-content">
        <header className="top-header">
          <div>
            <h1>
              {activeTab === 'dashboard' && 'Üretim Takip ve Kontrol Paneli'}
              {activeTab === 'stations' && 'İstasyon Bazlı Üretim Performansı'}
              {activeTab === 'quality' && 'Kalite & Hata Analiz Raporları'}
            </h1>
            <p>Saha Canlı Akış Verileri ve İstasyon Yönetimi</p>
          </div>
          <div className="user-badge">
            <div className="status-dot"></div>
            <span>Canlı Bağlantı (PLC/SCADA)</span>
          </div>
        </header>

        {activeTab === 'dashboard' && (
          <>
            <section className="kpi-grid">
              <div className="kpi-card">
                <div>
                  <div className="kpi-title">Toplam Üretim</div>
                  <div className="kpi-value">{totalCount}</div>
                </div>
                <div className="kpi-icon-box" style={{ backgroundColor: '#e0f2fe', color: '#0284c7' }}>
                  <Activity size={24} />
                </div>
              </div>

              <div className="kpi-card">
                <div>
                  <div className="kpi-title">Başarılı (OK)</div>
                  <div className="kpi-value" style={{ color: '#10b981' }}>{okCount}</div>
                </div>
                <div className="kpi-icon-box" style={{ backgroundColor: '#d1fae5', color: '#10b981' }}>
                  <CheckCircle2 size={24} />
                </div>
              </div>

              <div className="kpi-card">
                <div>
                  <div className="kpi-title">Hatalı (NOK)</div>
                  <div className="kpi-value" style={{ color: '#ef4444' }}>{nokCount}</div>
                </div>
                <div className="kpi-icon-box" style={{ backgroundColor: '#fee2e2', color: '#ef4444' }}>
                  <XCircle size={24} />
                </div>
              </div>

              <div className="kpi-card">
                <div>
                  <div className="kpi-title">Verimlilik Oranı</div>
                  <div className="kpi-value" style={{ color: '#f59e0b' }}>%{yieldRate}</div>
                </div>
                <div className="kpi-icon-box" style={{ backgroundColor: '#fef3c7', color: '#f59e0b' }}>
                  <Percent size={24} />
                </div>
              </div>
            </section>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px', marginBottom: '24px' }}>
              <section className="custom-card" style={{ marginBottom: 0 }}>
                <div className="card-header" style={{ justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <PlusCircle className="text-primary" size={20} />
                    <span>Yeni Üretim Kaydı Gir</span>
                  </div>

                  <button
                    type="button"
                    onClick={generateRandomBarcodes}
                    style={{
                      background: '#f1f5f9',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      padding: '6px 10px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: '#475569',
                      fontWeight: '600'
                    }}
                  >
                    <Scan size={14} /> Test Verisi Üret
                  </button>
                </div>

                <form onSubmit={handleAddRecord} className="form-grid">
                  <div className="input-group">
                    <label>20'li Ürün Kodu</label>
                    <input
                      ref={urunInputRef}
                      className="input-field"
                      type="text"
                      placeholder="Örn: 20260727000000000001"
                      value={urun20liKod}
                      onChange={(e) => setUrun20liKod(e.target.value)}
                      required
                    />
                  </div>
                  <div className="input-group">
                    <label>12'li Malzeme Kodu</label>
                    <input
                      ref={malzemeInputRef}
                      className="input-field"
                      type="text"
                      placeholder="Örn: 123456789012"
                      value={malzeme12liKod}
                      onChange={(e) => setMalzeme12liKod(e.target.value)}
                      required
                    />
                  </div>
                  <div className="input-group">
                    <label>İstasyon Adı</label>
                    <input
                      className="input-field"
                      type="text"
                      placeholder="Örn: Montaj_Hatti_01"
                      value={istasyonAdi}
                      onChange={(e) => setIstasyonAdi(e.target.value)}
                    />
                  </div>
                  <div className="input-group">
                    <label>Kalite Durumu</label>
                    <select
                      className="input-field"
                      value={kaliteDurumu}
                      onChange={(e) => setKaliteDurumu(e.target.value)}
                    >
                      <option value="OK">OK (Başarılı)</option>
                      <option value="NOK">NOK (Hatalı)</option>
                    </select>
                  </div>
                  <button type="submit" className="btn-primary" style={{ marginTop: '8px' }}>
                    <PlusCircle size={18} />
                    Kaydet
                  </button>
                </form>
              </section>

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

            <section className="custom-card">
              <div className="card-header" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Filter size={20} />
                  <span>Üretim Listesi ({filteredRecords.length})</span>
                </div>
                
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative' }}>
                    <input
                      className="input-field"
                      style={{ paddingLeft: '35px', width: '200px' }}
                      type="text"
                      placeholder="Koda göre ara..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '13px', color: '#94a3b8' }} />
                  </div>

                  <select
                    className="input-field"
                    value={selectedStation}
                    onChange={(e) => setSelectedStation(e.target.value)}
                  >
                    {stationsFilterOptions.map((st, i) => (
                      <option key={i} value={st}>{st}</option>
                    ))}
                  </select>

                  <select
                    className="input-field"
                    value={selectedQuality}
                    onChange={(e) => setSelectedQuality(e.target.value)}
                  >
                    <option value="Tümü">Tüm Kaliteler</option>
                    <option value="OK">OK</option>
                    <option value="NOK">NOK</option>
                  </select>

                  <button 
                    onClick={handleExportExcel}
                    style={{
                      backgroundColor: '#16a34a',
                      color: 'white',
                      border: 'none',
                      padding: '8px 14px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontWeight: '600',
                      fontSize: '14px'
                    }}
                  >
                    <FileSpreadsheet size={18} />
                    <span>Excel'e Aktar</span>
                  </button>
                </div>
              </div>

              <div className="table-wrapper">
                {loading && <p>Yükleniyor...</p>}
                {error && <p className="error">{error}</p>}
                {!loading && !error && (
                  <table className="modern-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>20'li Ürün Kodu</th>
                        <th>12'li Malzeme Kodu</th>
                        <th>İstasyon Adı</th>
                        <th>Kalite Durumu</th>
                        <th>Aksiyon</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRecords.length === 0 ? (
                        <tr>
                          <td colSpan="6" style={{ textAlign: 'center', padding: '30px' }}>
                            Kayıt bulunamadı.
                          </td>
                        </tr>
                      ) : (
                        filteredRecords.map((r) => (
                          <tr key={r.id}>
                            <td><b>#{r.id}</b></td>
                            <td><code style={{ background: '#f1f5f9', padding: '4px 8px', borderRadius: '4px' }}>{r.urun20liKod}</code></td>
                            <td><code style={{ background: '#f1f5f9', padding: '4px 8px', borderRadius: '4px' }}>{r.malzeme12liKod}</code></td>
                            <td>{r.istasyonAdi}</td>
                            <td>
                              <span
                                onClick={() => handleToggleQuality(r)}
                                className={`badge ${r.kaliteDurumu === 'OK' ? 'badge-ok' : 'badge-nok'}`}
                                title="Tıkla ve Değiştir"
                              >
                                {r.kaliteDurumu === 'OK' ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                                {r.kaliteDurumu}
                              </span>
                            </td>
                            <td>
                              <button
                                onClick={() => handleDelete(r.id)}
                                className="btn-delete"
                                title="Kaydı Sil"
                              >
                                <Trash2 size={18} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          </>
        )}

        {/* 📊 İSTASYONLAR SEKMESİ (ÇAKIŞMAYAN GRAFİK DÜZENLEMESİ) */}
        {activeTab === 'stations' && (
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
                    <BarChart 
                      data={stationChartData} 
                      margin={{ top: 20, right: 30, left: 0, bottom: 80 }}
                    >
                      <XAxis 
                        dataKey="name" 
                        interval={0}
                        angle={-35}
                        textAnchor="end"
                        tick={{ fontSize: 11, fill: '#475569' }}
                      />
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
        )}

        {activeTab === 'quality' && (
          <>
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
                              onClick={() => handleToggleQuality(r)}
                              className="badge badge-nok"
                              title="Tıkla ve OK Yap"
                            >
                              <XCircle size={14} />
                              {r.kaliteDurumu}
                            </span>
                          </td>
                          <td>
                            <button
                              onClick={() => handleDelete(r.id)}
                              className="btn-delete"
                              title="Kaydı Sil"
                            >
                              <Trash2 size={18} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default App;