import { Eye, Pencil, Trash2 } from "lucide-react";

/** A record the user has removed is read-only: it can be viewed, nothing more. */
export const isDeletedRow = (row) =>
  String(row?.Status || "").toLowerCase() === "deleted";

/**
 * The View / Edit / Delete column shared by every directory table.
 *
 * Centred, never sorted, and excluded from exports — buttons mean nothing in
 * a spreadsheet. Pass only the handlers a table supports: each button is left
 * out when its handler is missing, so a read-only list can offer View alone.
 *
 *   columns={[ ...theRealColumns, rowActionsColumn({ onView, onEdit, onDelete }) ]}
 *
 * `canWrite` false (saving not configured) leaves Edit and Delete visible but
 * disabled, with a tooltip saying why, rather than hiding them and making the
 * table look different depending on configuration.
 */
export function rowActionsColumn({
  onView,
  onEdit,
  onDelete,
  canWrite = true,
  busyId = "",
  idKey = "",
  header = "Actions",
  disabledReason = "Saving is not connected",
  labelFor = (row) => (idKey ? row[idKey] : "") || "this record",
}) {
  return {
    key: "actions",
    header,
    sortable: false,
    align: "center",
    exportValue: () => "",
    render: (row) => {
      const deleted = isDeletedRow(row);
      const busy = busyId && idKey && String(row[idKey]) === String(busyId);
      const label = labelFor(row);

      return (
        <div className="u-row" style={{ gap: 4, justifyContent: "center" }}>
          {onView && (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => onView(row)}
              title={`View ${label}`}
            >
              <Eye size={13} aria-hidden="true" />
              View
            </button>
          )}

          {onEdit && !deleted && (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => onEdit(row)}
              disabled={!canWrite || busy}
              title={canWrite ? `Edit ${label}` : disabledReason}
            >
              <Pencil size={13} aria-hidden="true" />
              Edit
            </button>
          )}

          {onDelete && !deleted && (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => onDelete(row)}
              disabled={!canWrite || busy}
              title={canWrite ? `Delete ${label}` : disabledReason}
            >
              <Trash2 size={13} aria-hidden="true" />
              {busy ? "Deleting…" : "Delete"}
            </button>
          )}
        </div>
      );
    },
  };
}
