import { CheckCircle2, Trash2, XCircle, Search, Filter, FileSpreadsheet, Eye } from 'lucide-react';
import { getStationDisplayName } from '../constants/stations';

const ProductionTable = ({
  loading,
  error,
  filteredRecords,
  searchTerm,
  selectedStation,
  selectedQuality,
  stationsFilterOptions,
  onSearchChange,
  onStationChange,
  onQualityChange,
  onExportExcel,
  onToggleQuality,
  onDelete,
  onOpenDetail,
  canChangeQuality = false,
  canDeleteRecord = false,
}) => {
  return (
    <section className="mes-surface p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Filter size={20} className="text-[color:var(--color-vestel)]" />
          <span className="mes-section-title">Üretim Listesi ({filteredRecords.length})</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <input
              className="mes-input pl-9"
              style={{ width: '180px' }}
              type="text"
              placeholder="Koda göre ara..."
              value={searchTerm}
              onChange={onSearchChange}
            />
            <Search size={16} className="pointer-events-none absolute left-3 top-2.5 text-slate-400" />
          </div>

          <select className="mes-input" style={{ width: 'auto' }} value={selectedStation} onChange={onStationChange}>
            {stationsFilterOptions.map((st) => (
              <option key={st} value={st}>{st === 'Tümü' ? 'Tüm İstasyonlar' : getStationDisplayName(st)}</option>
            ))}
          </select>

          <select className="mes-input" style={{ width: 'auto' }} value={selectedQuality} onChange={onQualityChange}>
            <option value="Tümü">Tüm Kaliteler</option>
            <option value="OK">OK</option>
            <option value="NOK">NOK</option>
          </select>

          <button type="button" onClick={onExportExcel} className="mes-btn-primary bg-emerald-700 hover:bg-emerald-800">
            <FileSpreadsheet size={16} />
            Excel&apos;e Aktar
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
                    <td>{getStationDisplayName(r.istasyonAdi)}</td>
                    <td>
                      <span
                        onClick={() => {
                          if (canChangeQuality) onToggleQuality(r);
                        }}
                        className={`badge ${r.kaliteDurumu === 'OK' ? 'badge-ok' : 'badge-nok'}`}
                        title={canChangeQuality ? 'Tıkla ve Değiştir' : 'Bu kullanıcı kalite değişikliği yapamaz'}
                        style={{
                          cursor: canChangeQuality ? 'pointer' : 'not-allowed',
                          opacity: canChangeQuality ? 1 : 0.75,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        {r.kaliteDurumu === 'OK' ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                        {r.kaliteDurumu}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => onOpenDetail(r)}
                          className="btn-delete"
                          title="Detayı Aç"
                        >
                          <Eye size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(r.id)}
                          className="btn-delete"
                          title={canDeleteRecord ? 'Kaydı Sil' : 'Silme izniniz yok'}
                          disabled={!canDeleteRecord}
                          style={{ opacity: canDeleteRecord ? 1 : 0.45, cursor: canDeleteRecord ? 'pointer' : 'not-allowed' }}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
};

export default ProductionTable;
