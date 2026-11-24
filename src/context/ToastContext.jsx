import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

const ToastContext = createContext(null);

/** Brief confirmations such as "Vendor V5 created" (section 7.2). */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (title, { text = "", tone = "success", ms = 5000 } = {}) => {
      const id = Date.now() + Math.random();
      setToasts((list) => [...list, { id, title, text, tone }]);
      if (ms) setTimeout(() => dismiss(id), ms);
      return id;
    },
    [dismiss]
  );

  const value = useMemo(
    () => ({
      toast: push,
      success: (title, text) => push(title, { text, tone: "success" }),
      error: (title, text) => push(title, { text, tone: "error", ms: 8000 }),
      // Something did happen, but not all of it — kept on screen longer.
      warning: (title, text) => push(title, { text, tone: "warn", ms: 9000 }),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tone === "error" ? "toast--error" : ""} ${t.tone === "warn" ? "toast--warn" : ""}`}>
            {t.tone === "error" || t.tone === "warn"
              ? (
                <AlertTriangle
                  size={17}
                  aria-hidden="true"
                  style={{
                    color: t.tone === "warn" ? "var(--c-warn)" : "var(--c-danger)",
                    flex: "0 0 auto",
                    marginTop: 1,
                  }}
                />
              )
              : <CheckCircle2 size={17} aria-hidden="true" style={{ color: "var(--c-ok)", flex: "0 0 auto", marginTop: 1 }} />}
            <div className="u-grow">
              <div className="toast__title">{t.title}</div>
              {t.text && <div className="toast__text">{t.text}</div>}
            </div>
            <button className="toast__close" onClick={() => dismiss(t.id)} aria-label="Dismiss">
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
