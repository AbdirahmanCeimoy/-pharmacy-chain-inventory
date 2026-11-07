// Reusable modal.
//   - Backdrop blur + dark overlay, prevents background interaction.
//   - White panel, centred, responsive, with close × button in the header.
//   - Esc key and backdrop click close; stops propagation on the panel.
//   - `footer` renders in the footer bar (typically Cancel + primary action).
//   - Body-scroll lock while open.

import { useEffect, useRef } from 'react';
import { XIcon } from './icons.jsx';

export default function Modal({
  open = true,
  title,
  description,
  onClose,
  children,
  footer,
  maxWidth = 'max-w-lg',
  labelledBy = 'modal-title',
}) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape') onClose?.();
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    // Focus first focusable in panel
    setTimeout(() => {
      const first = panelRef.current?.querySelector('input, select, textarea, button');
      first?.focus();
    }, 40);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-ink-primary/50 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        className={`panel w-full ${maxWidth} overflow-hidden`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
          <div>
            <h2 id={labelledBy} className="text-lg font-semibold text-ink-primary">
              {title}
            </h2>
            {description && <p className="mt-1 text-sm text-ink-secondary">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-ink-muted hover:bg-surface-muted hover:text-ink-primary"
          >
            <XIcon width={18} height={18} />
          </button>
        </header>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <footer className="flex flex-wrap justify-end gap-2 border-t border-line bg-surface-muted/40 px-6 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
