import { useEffect, useState } from 'react';
import { PlayCircle, X } from 'lucide-react';
import { ACTIVE_STATION_DEFINITIONS, DEFAULT_STATION } from '../constants/stations';
import { resolveShiftCodeForUtc, SHIFT_SCHEDULES } from '../constants/shifts';

/**
 * Structured dialog for starting a shop-floor shift session.
 */
const ShiftStartModal = ({
  open,
  onClose,
  onSubmit,
  defaultOperatorName = '',
  defaultOperatorId = '',
  defaultStationId = DEFAULT_STATION,
}) => {
  const [operatorName, setOperatorName] = useState(defaultOperatorName);
  const [operatorId, setOperatorId] = useState(defaultOperatorId);
  const [shiftCode, setShiftCode] = useState(() => resolveShiftCodeForUtc());
  const [stationId, setStationId] = useState(defaultStationId);

  useEffect(() => {
    if (!open) return;
    setOperatorName(defaultOperatorName || '');
    setOperatorId(defaultOperatorId || '');
    setStationId(defaultStationId || DEFAULT_STATION);
    setShiftCode(resolveShiftCodeForUtc());
  }, [open, defaultOperatorName, defaultOperatorId, defaultStationId]);

  if (!open) return null;

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!operatorName.trim()) return;
    onSubmit({
      operatorName: operatorName.trim(),
      operatorId: operatorId.trim() || operatorName.trim(),
      shiftCode,
      stationId,
    });
  };

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal-card confirm-dialog max-w-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shift-start-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="shift-start-title" className="m-0">Vardiya Başlat</h3>
            <p className="mes-helper mb-0 mt-1">
              Operatör oturumu KPI’ları sıfırdan başlar. Andon / hat KPI’ları katalog saat penceresinde birikmeye devam eder.
            </p>
          </div>
          <button type="button" className="mes-btn-ghost" onClick={onClose} aria-label="Kapat">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Operatör Bilgisi — Ad Soyad
            <input
              className="mes-input"
              value={operatorName}
              onChange={(event) => setOperatorName(event.target.value)}
              placeholder="Örn: Ayşe Yılmaz"
              required
              minLength={2}
              autoFocus
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Operatör ID / Sicil
            <input
              className="mes-input"
              value={operatorId}
              onChange={(event) => setOperatorId(event.target.value)}
              placeholder="Örn: OP-1042"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Oturum vardiya etiketi
            <select className="mes-input" value={shiftCode} onChange={(event) => setShiftCode(event.target.value)}>
              {SHIFT_SCHEDULES.map((shift) => (
                <option key={shift.code} value={shift.code}>{shift.label}</option>
              ))}
            </select>
            <span className="text-xs font-normal text-[color:var(--color-muted)]">
              Varsayılan: şu anki katalog penceresi. Hat OEE (Andon) saate göre katalog kodunu kullanır; bu seçim oturum kaydı içindir.
            </span>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Atanan İstasyon / Hat
            <select className="mes-input" value={stationId} onChange={(event) => setStationId(event.target.value)}>
              {ACTIVE_STATION_DEFINITIONS.map((station) => (
                <option key={station.id} value={station.id}>
                  {station.displayName} ({station.line})
                </option>
              ))}
            </select>
          </label>

          <div className="confirm-actions">
            <button type="button" className="mes-btn-secondary" onClick={onClose}>Vazgeç</button>
            <button type="submit" className="mes-btn-primary">
              <PlayCircle size={16} />
              Başlat
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ShiftStartModal;
