import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const NotificationContext = createContext(null);

let toastId = 0;

export const NotificationProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback((message, type = 'info') => {
    const id = ++toastId;
    setToasts((current) => [...current, { id, message, type }]);
    window.setTimeout(() => dismiss(id), 4500);
  }, [dismiss]);

  const confirm = useCallback((message) => new Promise((resolve) => {
    setConfirmState({
      message,
      resolve: (value) => {
        setConfirmState(null);
        resolve(value);
      },
    });
  }), []);

  const value = useMemo(() => ({ notify, confirm }), [notify, confirm]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-relevant="additions">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`} role="status">
            <span>{toast.message}</span>
            <button type="button" className="toast-close" onClick={() => dismiss(toast.id)} aria-label="Bildirimi kapat">
              ×
            </button>
          </div>
        ))}
      </div>
      {confirmState && (
        <div className="modal-overlay" role="presentation">
          <div
            className="modal-card confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
          >
            <h3 id="confirm-dialog-title">Onay gerekli</h3>
            <p>{confirmState.message}</p>
            <div className="confirm-actions">
              <button type="button" className="btn-secondary" onClick={() => confirmState.resolve(false)}>
                Vazgeç
              </button>
              <button type="button" className="btn-primary" onClick={() => confirmState.resolve(true)} autoFocus>
                Onayla
              </button>
            </div>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
};

export const useNotify = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotify must be used within NotificationProvider');
  }
  return context;
};
