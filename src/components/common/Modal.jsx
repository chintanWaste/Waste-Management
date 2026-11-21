import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Spinner } from "./States";

/**
 * Centred dialog used by every "create" and "add" form.
 *
 * Keeps the directory in place behind it instead of pushing it down the page.
 * Closes on Escape and on a click outside, locks the background from
 * scrolling, and keeps the keyboard inside while it is open.
 *
 * While `busy` is set the dialog covers itself with a spinner and refuses
 * every way out, so a save in flight cannot be abandoned half-written.
 */
export default function Modal({
  open,
  title,
  subtitle,
  size = "lg",
  onClose,
  children,
  closeOnBackdrop = true,
  busy = false,
  busyText = "Saving…",
}) {
  const panelRef = useRef(null);
  const returnFocusTo = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    returnFocusTo.current = document.activeElement;

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        if (!busy) onClose?.();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = panelRef.current?.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);

    // Move focus to the first real control, not the close button.
    const timer = setTimeout(() => {
      const target = panelRef.current?.querySelector(
        'input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
      );
      (target || panelRef.current)?.focus();
    }, 30);

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = overflow;
      clearTimeout(timer);
      returnFocusTo.current?.focus?.();
    };
  }, [open, onClose, busy]);

  if (!open) return null;

  return createPortal(
    <div
      className="modal"
      onMouseDown={(e) => {
        if (!busy && closeOnBackdrop && e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className={`modal__panel modal__panel--${size}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={panelRef}
        tabIndex={-1}
      >
        <header className="modal__head">
          <div>
            <h2 className="modal__title">{title}</h2>
            {subtitle && <p className="modal__subtitle">{subtitle}</p>}
          </div>
          <button
            type="button"
            className="modal__close"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
          >
            <X size={17} aria-hidden="true" />
          </button>
        </header>

        <div className="modal__body">{children}</div>

        {busy && (
          <div className="modal__busy" role="status" aria-live="polite">
            <Spinner />
            <div className="modal__busy-text">{busyText}</div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
