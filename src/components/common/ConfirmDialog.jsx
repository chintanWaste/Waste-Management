import Button from "./Button";
import Modal from "./Modal";
import { Banner } from "./States";

/**
 * Asks before something destructive, in the application's own dialog.
 *
 * Replaces window.confirm, which cannot be styled, looks like a browser
 * warning rather than part of the page, and in some browsers offers to
 * suppress every later prompt from the site.
 *
 * `busy` keeps the dialog open and blocked while the work is running, so the
 * same delete cannot be set off twice.
 */
export default function ConfirmDialog({
  open,
  title = "Are you sure?",
  subtitle,
  message,
  note,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  tone = "danger",
  busy = false,
  busyText = "Working…",
  onConfirm,
  onCancel,
}) {
  return (
    <Modal
      open={open}
      title={title}
      subtitle={subtitle}
      size="sm"
      onClose={onCancel}
      busy={busy}
      busyText={busyText}
    >
      {message && <p style={{ margin: "0 0 14px" }}>{message}</p>}

      {note && <Banner tone={tone === "danger" ? "warn" : "info"}>{note}</Banner>}

      <div className="formactions">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </Button>
        <Button type="button" variant={tone} onClick={onConfirm} disabled={busy}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
