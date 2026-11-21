/** Horizontal tab strip used by Inward entry, Dispatch, Stock and Certificates. */
export default function Tabs({ tabs, active, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          role="tab"
          aria-selected={active === tab.key}
          className={`tab ${active === tab.key ? "tab--active" : ""}`}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
          {tab.count != null && (
            <span className="badge badge--muted" style={{ marginLeft: 7 }}>{tab.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}
