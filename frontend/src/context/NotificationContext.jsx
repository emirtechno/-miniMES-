import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const NotificationContext = createContext(null);

let toastId = 0;

export const NotificationProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  /**
   * @param {string} message
   * @param {'info'|'success'|'error'} [type]
   * @param {{ actionLabel?: string, onAction?: () => void, durationMs?: number }} [options]
   */
  const notify = useCallback((message, type = 'info', options = {}) => {
    const id = ++toastId;
    const hasAction = Boolean(options.actionLabel && options.onAction);
    const durationMs = options.durationMs ?? (hasAction ? 12000 : 4500);
    setToasts((current) => [
      ...current,
      {
        id,
        message,
        type,
        actionLabel: options.actionLabel,
        onAction: options.onAction,
      },
    ]);
    window.setTimeout(() => dismiss(id), durationMs);
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
            <div className="toast-body">
              <span>{toast.message}</span>
              {toast.actionLabel && toast.onAction ? (
                <button
                  type="button"
                  className="toast-action"
                  onClick={() => {
                    toast.onAction();
                    dismiss(toast.id);
                  }}
                >
                  {toast.actionLabel}
                </button>
              ) : null}
            </div>
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
              <button type="button" className="mes-btn-secondary" onClick={() => confirmState.resolve(false)}>
                Vazgeç
              </button>
              <button type="button" className="mes-btn-primary" onClick={() => confirmState.resolve(true)} autoFocus>
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
