/** Status tags from section 4.6: Active (green), Inactive (grey), Pending approval (amber). */

const TONE_BY_STATUS = {
  active: "ok",
  done: "ok",
  approved: "ok",
  certified: "ok",
  inactive: "muted",
  cancelled: "muted",
  pending: "warn",
  "pending approval": "warn",
  "awaiting approval": "warn",
  expiring: "warn",
  rejected: "danger",
  expired: "danger",
  overdue: "danger",
};

export default function Badge({ children, tone, dot = false }) {
  const resolved =
    tone || TONE_BY_STATUS[String(children).toLowerCase().trim()] || "muted";

  return (
    <span className={`badge badge--${resolved}`}>
      {dot && <span className="badge__dot" />}
      {children}
    </span>
  );
}
