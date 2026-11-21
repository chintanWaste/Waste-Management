import { CheckCircle2 } from "lucide-react";
import Card from "../common/Card";
import { EmptyState } from "../common/States";
import { date } from "../../utils/format";

const TONE = {
  danger: "var(--c-danger)",
  warn: "var(--c-warn)",
  info: "var(--c-info)",
};

/** In-app alerts (section 6.4). Each stays open until a Super Admin closes it. */
export default function AlertsPanel({ alerts = [], canClose = false, onClose }) {
  return (
    <Card
      title="Alerts"
      subtitle={`${alerts.length} open`}
      flush
      actions={<span className="badge badge--warn">{alerts.length}</span>}
    >
      {alerts.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="No Open Alerts" text="Everything is up to date." />
      ) : (
        <div style={{ maxHeight: 420, overflowY: "auto" }}>
          {alerts.map((alert) => (
            <div className="alert" key={alert.id}>
              <span
                className="alert__mark"
                style={{ background: TONE[alert.severity] || TONE.info }}
              />
              <div className="u-grow">
                <div className="alert__title">{alert.title}</div>
                <div className="alert__meta">
                  {alert.message} · raised {date(alert.raisedOn)}
                </div>
              </div>
              {canClose && (
                <button
                  className="btn btn--ghost btn--sm"
                  onClick={() => onClose?.(alert.id)}
                  aria-label={`Close alert: ${alert.title}`}
                >
                  Close
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
