/**
 * A single dashboard figure.
 *
 * `value` of null or undefined means "nothing recorded yet" and renders as a
 * dash — never as a zero, which would read as a real measurement.
 */
export default function StatTile({ label, value, unit, tone, splits = [], loading }) {
  const hasValue = value !== null && value !== undefined && value !== "";

  return (
    <article className={`stat ${tone && hasValue ? `stat--${tone}` : ""}`}>
      <div className="stat__label">{label}</div>

      {loading ? (
        <div className="skeleton" style={{ height: 26, width: "60%", marginTop: 8 }} />
      ) : hasValue ? (
        <div className="stat__value">
          {value}
          {unit && <span className="stat__unit">{unit}</span>}
        </div>
      ) : (
        <div className="stat__value stat__value--empty">—</div>
      )}

      {!loading && hasValue && splits.length > 0 && (
        <div className="stat__split">
          {splits.map((s) => (
            <span key={s.label}>
              {s.label} <b>{s.value}</b>
            </span>
          ))}
        </div>
      )}
    </article>
  );
}
