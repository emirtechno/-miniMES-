import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

/**
 * Shared modal shell used by confirm dialogs, shift/HMI flows, and detail views.
 */
const MesModal = ({
  open,
  onClose,
  title,
  children,
  className = '',
  labelledBy,
  closeOnOverlay = true,
}) => {
  const titleId = useId();
  const closeRef = useRef(null);
  const previouslyFocused = useRef(null);
  const headingId = labelledBy || titleId;

  useEffect(() => {
    if (!open) return undefined;

    previouslyFocused.current = document.activeElement;
    closeRef.current?.focus();

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previouslyFocused.current instanceof HTMLElement) {
        previouslyFocused.current.focus();
      }
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      role="presentation"
      onClick={closeOnOverlay ? onClose : undefined}
    >
      <div
        className={`modal-card confirm-dialog ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? headingId : undefined}
        onClick={(event) => event.stopPropagation()}
      >
        {(title || onClose) && (
          <div className="flex items-start justify-between gap-3">
            {title ? <h3 id={headingId} className="m-0">{title}</h3> : <span />}
            {onClose ? (
              <button
                ref={closeRef}
                type="button"
                className="mes-btn-ghost"
                onClick={onClose}
                aria-label="Kapat"
              >
                <X size={16} />
              </button>
            ) : null}
          </div>
        )}
        {children}
      </div>
    </div>
  );
};

export default MesModal;
