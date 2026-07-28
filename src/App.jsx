import { useState, useEffect } from 'react';
import axios from 'axios';
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
  AlertTriangle
} from 'lucide-react';
import './App.css';

function App() {
  // Aktif Sekme Yönetimi: 'dashboard' | 'stations' | 'quality'
  const [activeTab, setActiveTab] = useState('dashboard');

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Form alanları
  const [urun20liKod, setUrun20liKod] = useState('');
  const [malzeme12liKod, setMalzeme12liKod] = useState('');
  const [istasyonAdi, setIstasyonAdi] = useState('');
  const [kaliteDurumu, setKaliteDurumu] = useState('OK');

  // Filtreleme ve Arama
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

  const handleAddRecord = async (e) => {
    e.preventDefault();

    if (urun20liKod.length !== 20 || isNaN(urun20liKod)) {
      alert("Hata: 20'li Ürün Kodu tam 20 haneli sayı olmalıdır!");
      return;
    }

    if (malzeme12liKod.length !== 12 || isNaN(malzeme12liKod)) {
      alert("Hata: 12'li Malzeme Kodu tam 12 haneli sayı olmalıdır!");
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
    } catch (err) {
      const backendError = err.response?.data?.message || err.response?.data || err.message;
      alert(`Kayıt eklenirken hata oluştu!\nDetay: ${typeof backendError === 'object' ? JSON.stringify(backendError) : backendError}`);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(`ID: ${id} olan üretim kaydını silmek istediğinize emin misiniz?`)) return;

    try {
      await axios.delete(`${API_URL}/${id}`);
      fetchRecords();
    } catch (err) {
      alert('Silme işlemi başarısız oldu!');
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

  // Dinamik İstasyon Listesi
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

  return (
    <div className="app-container">
      {/* Sol Navigasyon Menüsü */}
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
            <LayoutDashboard className="icon" size={20} />
            <span>Üretim Paneli</span>
          </li>
          <li 
            className={`menu-item ${activeTab === 'stations' ? 'active' : ''}`}
            onClick={() => setActiveTab('stations')}
          >
            <Cpu className="icon" size={20} />
            <span>İstasyonlar</span>
          </li>
          <li 
            className={`menu-item ${activeTab === 'quality' ? 'active' : ''}`}
            onClick={() => setActiveTab('quality')}
          >
            <Activity className="icon" size={20} />
            <span>Kalite Raporları</span>
          </li>
        </ul>
      </aside>

      {/* Ana İçerik Alanı */}
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

        {/* -------------------- 1. SEKMESİ: ÜRETİM PANELİ (DASHBOARD) -------------------- */}
        {activeTab === 'dashboard' && (
          <>
            {/* KPI İstatistik Kartları */}
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

            {/* Yeni Kayıt Ekleme Formu */}
            <section className="custom-card">
              <div className="card-header">
                <PlusCircle className="text-primary" size={20} />
                <span>Yeni Üretim Kaydı Gir</span>
              </div>
              <form onSubmit={handleAddRecord} className="form-grid">
                <div className="input-group">
                  <label>20'li Ürün Kodu</label>
                  <input
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
                <button type="submit" className="btn-primary">
                  <PlusCircle size={18} />
                  Kaydet
                </button>
              </form>
            </section>

            {/* Filtreleme ve Tablo */}
            <section className="custom-card">
              <div className="card-header" style={{ justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Filter size={20} />
                  <span>Üretim Listesi ({filteredRecords.length})</span>
                </div>
                
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ position: 'relative' }}>
                    <input
                      className="input-field"
                      style={{ paddingLeft: '35px', width: '220px' }}
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

        {/* -------------------- 2. SEKMESİ: İSTASYONLAR -------------------- */}
        {activeTab === 'stations' && (
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
        )}

        {/* -------------------- 3. SEKMESİ: KALİTE RAPORLARI -------------------- */}
        {activeTab === 'quality' && (
          <>
            <section className="custom-card" style={{ borderLeft: '5px solid #ef4444' }}>
              <div className="card-header" style={{ color: '#ef4444' }}>
                <AlertTriangle size={20} />
                <span>Kalite Kontrol Alarm & Hata Özeti</span>
              </div>
              <p style={{ color: '#64748b', margin: 0 }}>
                Aşağıdaki tabloda üretim hattında <b>NOK (Hatalı)</b> olarak işaretlenmiş tüm ürünler listelenmektedir. Tekrar teste giren ürünlerin kalitesini tıklayarak düzeltebilirsiniz.
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