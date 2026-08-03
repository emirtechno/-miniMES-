import { useEffect, useState } from 'react';
import { Delete, X } from 'lucide-react';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'];

/**
 * Touchscreen numeric keypad for secondary operator PIN login.
 */
const OperatorKeypadModal = ({ open, onClose, onSubmit }) => {
  const [pin, setPin] = useState('');
  const [nameHint, setNameHint] = useState('');

  useEffect(() => {
    if (open) {
      setPin('');
      setNameHint('');
    }
  }, [open]);

  if (!open) return null;

  const press = (key) => {
    if (key === 'C') {
      setPin('');
      return;
    }
    if (key === '⌫') {
      setPin((current) => current.slice(0, -1));
      return;
    }
    setPin((current) => (current.length >= 8 ? current : `${current}${key}`));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (pin.length < 4) return;
    onSubmit(pin, nameHint.trim() || undefined);
    onClose();
  };

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal-card confirm-dialog max-w-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="keypad-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="keypad-title" className="m-0">Operatör İşlemleri</h3>
            <p className="mes-helper mb-0 mt-1">İkincil operatör PIN girişi (dokunmatik)</p>
          </div>
          <button type="button" className="mes-btn-ghost" onClick={onClose} aria-label="Kapat">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Operatör adı (opsiyonel)
            <input
              className="mes-input"
              value={nameHint}
              onChange={(event) => setNameHint(event.target.value)}
              placeholder="Örn: Mehmet Kaya"
            />
          </label>

          <div className="rounded-xl border border-[color:var(--color-line)] bg-slate-950 px-4 py-5 text-center font-mono text-3xl tracking-[0.35em] text-white">
            {pin ? '•'.repeat(pin.length) : 'PIN'}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {KEYS.map((key) => (
              <button
                key={key}
                type="button"
                className="mes-keypad-key"
                onClick={() => press(key)}
              >
                {key === '⌫' ? <Delete size={20} /> : key}
              </button>
            ))}
          </div>

          <div className="confirm-actions">
            <button type="button" className="mes-btn-secondary" onClick={onClose}>Vazgeç</button>
            <button type="submit" className="mes-btn-primary" disabled={pin.length < 4}>
              Giriş Yap
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OperatorKeypadModal;
