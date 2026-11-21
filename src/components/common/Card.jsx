export default function Card({ title, subtitle, actions, flush = false, children, className = "" }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="card__head">
          <div>
            {title && <div className="card__title">{title}</div>}
            {subtitle && <div className="u-small u-muted">{subtitle}</div>}
          </div>
          {actions && <div className="u-row">{actions}</div>}
        </header>
      )}
      <div className={`card__body ${flush ? "card__body--flush" : ""}`}>{children}</div>
    </section>
  );
}
