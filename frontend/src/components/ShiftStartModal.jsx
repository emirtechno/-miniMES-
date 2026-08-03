import { useEffect, useState } from 'react';
import { PlayCircle } from 'lucide-react';
import MesModal from './MesModal';
import { ACTIVE_STATION_DEFINITIONS, DEFAULT_STATION } from '../constants/stations';
import { SHIFT_SCHEDULES } from '../constants/shifts';

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
  const [shiftCode, setShiftCode] = useState(SHIFT_SCHEDULES[0].code);
  const [stationId, setStationId] = useState(defaultStationId);

  useEffect(() => {
    if (!open) return;
    setOperatorName(defaultOperatorName || '');
    setOperatorId(defaultOperatorId || '');
    setStationId(defaultStationId || DEFAULT_STATION);
    setShiftCode(SHIFT_SCHEDULES[0].code);
  }, [open, defaultOperatorName, defaultOperatorId, defaultStationId]);

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
    <MesModal open={open} onClose={onClose} title="Vardiya Başlat" className="max-w-lg">
      <p className="mes-helper mb-0 -mt-1">Operatör, vardiya ve istasyon bilgisini girin.</p>
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
          Vardiya Seçimi
          <select className="mes-input" value={shiftCode} onChange={(event) => setShiftCode(event.target.value)}>
            {SHIFT_SCHEDULES.map((shift) => (
              <option key={shift.code} value={shift.code}>{shift.label}</option>
            ))}
          </select>
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
    </MesModal>
  );
};

export default ShiftStartModal;
