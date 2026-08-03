import { useEffect, useState } from 'react';
import {
  AlertOctagon,
  ClipboardList,
  Coffee,
  Flame,
  LogOut,
  UserCog,
  Wrench,
  X,
} from 'lucide-react';
import { fetchDowntimeReasons } from '../services/api';
import OperatorKeypadModal from './OperatorKeypadModal';

const FALLBACK_REASONS = [
  { code: 'CHANGEOVER', name: 'Model/hat değişimi', isPlanned: true },
  { code: 'PLANNED_MAINTENANCE', name: 'Planlı bakım', isPlanned: true },
  { code: 'BREAKDOWN', name: 'Arıza', isPlanned: false },
  { code: 'MATERIAL_SHORTAGE', name: 'Malzeme eksikliği', isPlanned: false },
  { code: 'NO_OPERATOR', name: 'Operatör yok / mola', isPlanned: false },
];

/**
 * Industrial HMI-style touch action bar for the operator panel.
 */
const ShopFloorActionBar = ({
  shift,
  notify,
  onKeypadLogin,
  onDowntime,
  onScrap,
  onSetup,
  onEmergency,
  onEndShift,
  onResume,
}) => {
  const [showKeypad, setShowKeypad] = useState(false);
  const [showDowntime, setShowDowntime] = useState(false);
  const [showScrap, setShowScrap] = useState(false);
  const [showEndSummary, setShowEndSummary] = useState(false);
  const [reasons, setReasons] = useState(FALLBACK_REASONS);
  const [selectedReason, setSelectedReason] = useState('NO_OPERATOR');
  const [scrapQty, setScrapQty] = useState(1);

  useEffect(() => {
    const controller = new AbortController();
    fetchDowntimeReasons({ signal: controller.signal })
      .then((items) => {
        const usable = (items || []).filter((item) => item.code && item.code !== 'NONE');
        if (usable.length) {
          setReasons(usable);
          setSelectedReason(usable[0].code);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const requireActive = (action) => {
    if (!shift.active) {
      notify?.('Önce vardiyayı başlatın.', 'error');
      return false;
    }
    action();
    return true;
  };

  const submitDowntime = async () => {
    const reason = reasons.find((item) => item.code === selectedReason);
    const ok = await onDowntime({
      reasonCode: selectedReason,
      reasonName: reason?.name,
      isPlanned: reason?.isPlanned,
    });
    if (ok) setShowDowntime(false);
  };

  const submitEmergency = async () => {
    await onEmergency({
      reasonCode: 'BREAKDOWN',
      reasonName: 'Arıza / Acil Durum',
      isPlanned: false,
      emergency: true,
    });
  };

  return (
    <section className="mes-surface p-5">
      <div className="mb-4">
        <h3 className="mes-section-title m-0">Operatör Saha Butonları</h3>
        <p className="mes-helper mb-0 mt-1">Dokunmatik HMI aksiyon çubuğu — renk kodlu hızlı işlemler</p>
      </div>

      <div className="mes-hmi-grid">
        <button type="button" className="mes-hmi-btn mes-hmi-blue" onClick={() => setShowKeypad(true)}>
          <UserCog size={28} />
          <span>Operatör İşlemleri</span>
          <small>PIN / Keypad</small>
        </button>

        <button
          type="button"
          className="mes-hmi-btn mes-hmi-orange"
          onClick={() => {
            if (!shift.active) {
              notify?.('Önce vardiyayı başlatın.', 'error');
              return;
            }
            if (shift.onBreak || shift.inSetup) onResume();
            else setShowDowntime(true);
          }}
        >
          <Coffee size={28} />
          <span>{shift.onBreak || shift.inSetup ? 'Üretime Dön' : 'Duruş / Mola Bildir'}</span>
          <small>Stoppage</small>
        </button>

        <button
          type="button"
          className="mes-hmi-btn mes-hmi-red-soft"
          onClick={() => requireActive(() => setShowScrap(true))}
        >
          <Flame size={28} />
          <span>Fire / Hata Girişi</span>
          <small>Scrap · {shift.scrapCount || 0}</small>
        </button>

        <button
          type="button"
          className="mes-hmi-btn mes-hmi-green"
          onClick={() => {
            if (shift.inSetup) onResume();
            else requireActive(() => onSetup());
          }}
        >
          <Wrench size={28} />
          <span>{shift.inSetup ? 'Setup Bitir' : 'Model Değişimi / Setup'}</span>
          <small>Changeover</small>
        </button>

        <button
          type="button"
          className="mes-hmi-btn mes-hmi-danger"
          onClick={() => requireActive(() => submitEmergency())}
        >
          <AlertOctagon size={28} />
          <span>Arıza Bildir / Emergency</span>
          <small>Kritik alarm</small>
        </button>

        <button
          type="button"
          className="mes-hmi-btn mes-hmi-navy"
          onClick={() => {
            if (!shift.active) {
              notify?.('Önce vardiyayı başlatın.', 'error');
              return;
            }
            setShowEndSummary(true);
          }}
        >
          <LogOut size={28} />
          <span>Vardiyayı Bitir</span>
          <small>Shift end</small>
        </button>
      </div>

      <OperatorKeypadModal
        open={showKeypad}
        onClose={() => setShowKeypad(false)}
        onSubmit={onKeypadLogin}
      />

      {showDowntime && (
        <div className="modal-overlay" role="presentation" onClick={() => setShowDowntime(false)}>
          <div className="modal-card confirm-dialog" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <h3 className="m-0">Duruş / Mola Bildir</h3>
              <button type="button" className="mes-btn-ghost" onClick={() => setShowDowntime(false)}><X size={16} /></button>
            </div>
            <p className="mes-helper mb-0">Neden seçin — kayıt Andon / alarm akışına düşer.</p>
            <select className="mes-input" value={selectedReason} onChange={(e) => setSelectedReason(e.target.value)}>
              {reasons.map((reason) => (
                <option key={reason.code} value={reason.code}>
                  {reason.name}{reason.isPlanned ? ' (planlı)' : ''}
                </option>
              ))}
            </select>
            <div className="confirm-actions">
              <button type="button" className="mes-btn-secondary" onClick={() => setShowDowntime(false)}>Vazgeç</button>
              <button type="button" className="mes-btn-primary" onClick={submitDowntime}>Kaydet</button>
            </div>
          </div>
        </div>
      )}

      {showScrap && (
        <div className="modal-overlay" role="presentation" onClick={() => setShowScrap(false)}>
          <div className="modal-card confirm-dialog" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <h3 className="m-0">Fire / Hata Girişi</h3>
              <button type="button" className="mes-btn-ghost" onClick={() => setShowScrap(false)}><X size={16} /></button>
            </div>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Fire adedi
              <input
                type="number"
                min={1}
                max={999}
                className="mes-input"
                value={scrapQty}
                onChange={(e) => setScrapQty(Number(e.target.value) || 1)}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 5, 10].map((n) => (
                <button key={n} type="button" className="mes-btn-secondary" onClick={() => setScrapQty(n)}>+{n}</button>
              ))}
            </div>
            <div className="confirm-actions">
              <button type="button" className="mes-btn-secondary" onClick={() => setShowScrap(false)}>Vazgeç</button>
              <button
                type="button"
                className="mes-btn-danger"
                onClick={() => {
                  onScrap(scrapQty);
                  setShowScrap(false);
                  setScrapQty(1);
                }}
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {showEndSummary && (
        <div className="modal-overlay" role="presentation" onClick={() => setShowEndSummary(false)}>
          <div className="modal-card confirm-dialog" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <h3 className="m-0 flex items-center gap-2"><ClipboardList size={18} /> Vardiyayı Bitir</h3>
              <button type="button" className="mes-btn-ghost" onClick={() => setShowEndSummary(false)}><X size={16} /></button>
            </div>
            <p className="mes-helper mb-0">Oturum kapanacak ve özet kaydedilecek.</p>
            <ul className="m-0 list-none space-y-1 p-0 text-sm">
              <li><b>Operatör:</b> {shift.operatorName || '—'}</li>
              <li><b>İstasyon:</b> {shift.stationId}</li>
              <li><b>Fire toplamı:</b> {shift.scrapCount || 0}</li>
              {shift.secondaryOperator && (
                <li><b>İkincil op:</b> {shift.secondaryOperator.name}</li>
              )}
            </ul>
            <div className="confirm-actions">
              <button type="button" className="mes-btn-secondary" onClick={() => setShowEndSummary(false)}>Vazgeç</button>
              <button
                type="button"
                className="mes-btn-danger"
                onClick={() => {
                  setShowEndSummary(false);
                  onEndShift();
                }}
              >
                Vardiyayı Bitir
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default ShopFloorActionBar;
