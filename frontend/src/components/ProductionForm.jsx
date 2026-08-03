import { PlusCircle, Scan } from 'lucide-react';
import { ACTIVE_STATION_DEFINITIONS } from '../constants/stations';

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
}) => (
  <section className="mes-surface p-5">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <PlusCircle className="text-[color:var(--color-vestel)]" size={20} />
        <span className="mes-section-title">Yeni Üretim Kaydı</span>
      </div>
      <button type="button" onClick={onGenerateRandom} className="mes-btn-secondary text-xs" disabled={!canSubmit}>
        <Scan size={14} /> Test Verisi Üret
      </button>
    </div>

    <form onSubmit={onSubmit} className="grid gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium">
        20&apos;li Ürün Kodu
        <input
          ref={urunInputRef}
          className="mes-input"
          type="text"
          placeholder="Örn: 20260727000000000001"
          value={urun20liKod}
          onChange={onChangeUrun}
          minLength={3}
          maxLength={20}
          required
          disabled={!canSubmit}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        12&apos;li Malzeme Kodu
        <input
          ref={malzemeInputRef}
          className="mes-input"
          type="text"
          placeholder="Örn: 123456789012"
          value={malzeme12liKod}
          onChange={onChangeMalzeme}
          minLength={3}
          maxLength={12}
          required
          disabled={!canSubmit}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        İstasyon
        <select className="mes-input" value={istasyonAdi} onChange={onChangeStation} required disabled={!canSubmit}>
          <option value="">İstasyon seçin</option>
          {ACTIVE_STATION_DEFINITIONS.map((station) => (
            <option key={station.id} value={station.id}>
              {station.displayName} ({station.line})
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Kalite Durumu
        <select className="mes-input" value={kaliteDurumu} onChange={onChangeQuality} disabled={!canSubmit}>
          <option value="OK">OK (Başarılı)</option>
          <option value="NOK">NOK (Hatalı)</option>
        </select>
      </label>
      <button type="submit" className="mes-btn-primary" disabled={!canSubmit}>
        <PlusCircle size={18} />
        Kaydet
      </button>
      {!canSubmit && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Bu kullanıcı üretim kaydı ekleme yetkisine sahip değil.
        </div>
      )}
    </form>
  </section>
);

export default ProductionForm;
