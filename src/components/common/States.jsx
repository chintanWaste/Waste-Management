import {
  AlertTriangle, CheckCircle2, FileSearch, Info, RotateCw,
} from "lucide-react";

/** Loading, empty and error states — used by every list and card. */

export function Spinner() {
  return <div className="spinner" role="status" aria-label="Loading" />;
}

export function Loading({ text = "Loading…" }) {
  return (
    <div className="state">
      <Spinner />
      <div className="state__text" style={{ marginTop: 10 }}>{text}</div>
    </div>
  );
}

export function EmptyState({ icon: Icon = FileSearch, title = "Nothing here yet", text }) {
  return (
    <div className="state">
      <Icon className="state__icon" size={30} strokeWidth={1.5} aria-hidden="true" />
      <div className="state__title">{title}</div>
      {text && <div className="state__text">{text}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="state">
      <AlertTriangle className="state__icon" size={30} strokeWidth={1.5} aria-hidden="true" />
      <div className="state__title">Could not load this data</div>
      <div className="state__text">{String(error)}</div>
      {onRetry && (
        <button className="btn btn--secondary btn--sm" style={{ marginTop: 14 }} onClick={onRetry}>
          <RotateCw size={14} aria-hidden="true" />
          Try again
        </button>
      )}
    </div>
  );
}

const BANNER_ICON = {
  info: Info,
  warn: AlertTriangle,
  danger: AlertTriangle,
  success: CheckCircle2,
};

export function Banner({ tone = "info", icon: Icon, children }) {
  const Resolved = Icon || BANNER_ICON[tone] || Info;
  return (
    <div className={`banner banner--${tone}`}>
      <Resolved size={17} strokeWidth={2} aria-hidden="true" style={{ flex: "0 0 auto", marginTop: 1 }} />
      <div>{children}</div>
    </div>
  );
}

export function SkeletonRows({ rows = 5 }) {
  return (
    <div className="u-col" style={{ padding: 16 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton" style={{ width: `${100 - i * 7}%` }} />
      ))}
    </div>
  );
}
