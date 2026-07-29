import { X } from 'lucide-react';

const DetailModal = ({ record, isOpen, onClose }) => {
  if (!isOpen || !record) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Üretim Detay</h3>
          <button className="btn-delete" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <div className="modal-row"><span>ID</span><strong>#{record.id}</strong></div>
          <div className="modal-row"><span>20'li Ürün Kodu</span><strong>{record.urun20liKod}</strong></div>
          <div className="modal-row"><span>12'li Malzeme Kodu</span><strong>{record.malzeme12liKod}</strong></div>
          <div className="modal-row"><span>İstasyon</span><strong>{record.istasyonAdi}</strong></div>
          <div className="modal-row"><span>Kalite</span><strong>{record.kaliteDurumu}</strong></div>
          <div className="modal-row"><span>Üretim Tarihi</span><strong>{record.uretimTarihi ? new Date(record.uretimTarihi).toLocaleString('tr-TR') : '-'}</strong></div>
        </div>
      </div>
    </div>
  );
};

export default DetailModal;
