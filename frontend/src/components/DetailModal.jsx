import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

const DetailModal = ({ record, isOpen, onClose }) => {
  const closeRef = useRef(null);
  const previouslyFocused = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    previouslyFocused.current = document.activeElement;
    closeRef.current?.focus();

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previouslyFocused.current instanceof HTMLElement) {
        previouslyFocused.current.focus();
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen || !record) return null;

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-modal-title"
      >
        <div className="modal-header">
          <h3 id="detail-modal-title">Üretim Detay</h3>
          <button
            ref={closeRef}
            type="button"
            className="btn-delete"
            onClick={onClose}
            aria-label="Detay penceresini kapat"
          >
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
