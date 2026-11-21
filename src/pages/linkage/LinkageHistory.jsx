import { X } from "lucide-react";
import Badge from "../../components/common/Badge";
import { EmptyState } from "../../components/common/States";
import { date } from "../../utils/format";
import { historyFor } from "../../services/linkageService";

/** Past and present allocations of one BWG, with their date ranges. */
export default function LinkageHistory({ bwg, rows, vendorName, onClose }) {
  const history = historyFor(rows, bwg.BWG_Code);

  return (
    <div className="drawer" role="dialog" aria-label={`Linkage history for ${bwg.BWG_Name}`}>
      <div className="drawer__head">
        <div>
          <div className="card__title">{bwg.BWG_Code} · {bwg.BWG_Name}</div>
          <div className="u-small u-muted">Vendor allocation history</div>
        </div>
        <button className="toast__close" onClick={onClose} aria-label="Close">
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="drawer__body">
        {history.length === 0 ? (
          <EmptyState title="Never Linked" text="This BWG has not been allocated to a vendor yet." />
        ) : (
          <ol className="timeline">
            {history.map((row) => {
              const open = !String(row.Linked_To_Date || "").trim();
              return (
                <li key={row.Linkage_Id} className={`timeline__item ${open ? "timeline__item--open" : ""}`}>
                  <div className="u-row-between u-wrap">
                    <div>
                      <div style={{ fontWeight: 650, color: "var(--c-ink)" }}>
                        {row.Vendor_Code} — {vendorName[row.Vendor_Code] || "Unknown vendor"}
                      </div>
                      <div className="u-small u-muted">
                        {date(row.Linked_From_Date)} → {open ? "present" : date(row.Linked_To_Date)}
                      </div>
                    </div>
                    {open && <Badge tone="ok">Current</Badge>}
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        <p className="field__hint" style={{ marginTop: 14 }}>
          Changing the vendor never alters past figures — each BWG daily inward row
          stores the vendor that was linked on its collection date.
        </p>
      </div>
    </div>
  );
}
