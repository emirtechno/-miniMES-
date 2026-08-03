import { PlusCircle, Scan } from 'lucide-react';
import { STATIONS } from '../constants/stations';

const ProductionForm = ({
  urun20liKod,
  malzeme12liKod,
  istasyonAdi,
  kaliteDurumu,
  onChangeUrun,
  onChangeMalzeme,
  onChangeStation,
  onChangeQuality,
  onSubmit,
  onGenerateRandom,
  urunInputRef,
  malzemeInputRef,
  canSubmit = true,
}) => {
  return (
    <section className="custom-card" style={{ marginBottom: 0 }}>
      <div className="card-header" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <PlusCircle className="text-primary" size={20} />
          <span>Yeni Üretim Kaydı Gir</span>
        </div>

        <button
          type="button"
          onClick={onGenerateRandom}
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

      <form onSubmit={onSubmit} className="form-grid">
        <div className="input-group">
          <label>20'li Ürün Kodu</label>
          <input
            ref={urunInputRef}
            className="input-field"
            type="text"
            placeholder="Örn: 20260727000000000001"
            value={urun20liKod}
            onChange={onChangeUrun}
            required
            disabled={!canSubmit}
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
            onChange={onChangeMalzeme}
            required
            disabled={!canSubmit}
          />
        </div>
        <div className="input-group">
          <label>İstasyon Adı</label>
          <select
            className="input-field"
            value={istasyonAdi}
            onChange={onChangeStation}
            required
            disabled={!canSubmit}
          >
            <option value="">İstasyon seçin</option>
            {STATIONS.map((station) => <option key={station} value={station}>{station}</option>)}
          </select>
        </div>
        <div className="input-group">
          <label>Kalite Durumu</label>
          <select className="input-field" value={kaliteDurumu} onChange={onChangeQuality} disabled={!canSubmit}>
            <option value="OK">OK (Başarılı)</option>
            <option value="NOK">NOK (Hatalı)</option>
          </select>
        </div>
        <button
          type="submit"
          className="btn-primary"
          style={{ marginTop: '8px', opacity: canSubmit ? 1 : 0.65, cursor: canSubmit ? 'pointer' : 'not-allowed' }}
          disabled={!canSubmit}
        >
          <PlusCircle size={18} />
          Kaydet
        </button>
        {!canSubmit && (
          <div className="custom-card" style={{ marginTop: '12px', borderColor: '#f59e0b', backgroundColor: '#fffbeb', color: '#92400e' }}>
            Bu kullanıcı üretim kaydı ekleme yetkisine sahip değil.
          </div>
        )}
      </form>
    </section>
  );
};

export default ProductionForm;
