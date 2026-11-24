import { useState } from "react";
import Button from "../../components/common/Button";
import Modal from "../../components/common/Modal";
import { TextInput } from "../../components/common/Field";
import { Banner } from "../../components/common/States";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import {
  SUPERVISOR_EDIT_DAYS, saveEntryEdit, withinSupervisorEditWindow,
} from "../../services/adminService";
import { date, kg } from "../../utils/format";
import CategorySheet from "./CategorySheet";

/**
 * Edit one inward entry — sections 3.3 and 12.4.
 *
 * A Super Admin's change is written immediately. A Supervisor's is saved as a
 * pending approval, and only within three days of the entry being created;
 * the entry keeps its original values until a Super Admin decides.
 *
 * `categorised` marks the sources whose total is broken down in
 * Entry_Categories — RRR on Wheels, Special collection and BWG
 * characterisation. For those, changing the total means the break-up no
 * longer adds up, so section 12.4 requires it to be re-entered in the same
 * step. The sheet below only appears once the total has actually changed.
 */
export default function InwardEditDialog({
  open,
  tab,
  row,
  quantityField,
  label,
  categorised = false,
  onSaved,
  onClose,
}) {
  const { user, isSuperAdmin } = useAuth();
  const toast = useToast();

  const originalTotal = Number(row?.[quantityField] ?? 0);
  // Each caller mounts this per row (`key` on the row's id) and only while a
  // row is being edited, so the field can be seeded once from that row. It
  // used to be mounted permanently behind the table, where this ran with no
  // row and left 0 in the box however many entries were opened afterwards.
  const [total, setTotal] = useState(() =>
    row?.[quantityField] == null ? "" : String(originalTotal)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const nextTotal = Number(total);
  const valid = Number.isFinite(nextTotal) && nextTotal > 0;
  const changed = valid && Math.abs(nextTotal - originalTotal) > 0.005;
  const needsCategories = categorised && changed;

  const inWindow = isSuperAdmin || withinSupervisorEditWindow(row);

  const save = async (categories) => {
    setSaving(true);
    setError("");
    try {
      const result = await saveEntryEdit({
        tab,
        recordId: row[tab.idColumn],
        record: row,
        newValues: { [quantityField]: String(nextTotal) },
        categories,
        isSuperAdmin,
        user,
      });

      if (result.applied) {
        toast.success("Entry updated", `${label} is now ${kg(nextTotal)}.`);
      } else {
        toast.success(
          "Sent for approval",
          `${label} stays at ${kg(originalTotal)} until a Super Admin approves the change.`
        );
      }
      onSaved?.(result);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={`Edit ${row?.[tab?.idColumn] || "entry"}`}
      subtitle={label}
      onClose={onClose}
      busy={saving}
      busyText={isSuperAdmin ? "Saving the change…" : "Sending for approval…"}
    >
      {error && (
        <div style={{ marginBottom: 16 }}><Banner tone="danger">{error}</Banner></div>
      )}

      {!inWindow && (
        <div style={{ marginBottom: 16 }}>
          <Banner tone="warn">
            This entry was created more than {SUPERVISOR_EDIT_DAYS} days ago
            {row?.Created_On ? ` (on ${date(row.Created_On)})` : ""}, so it can no longer
            be edited. Ask a Super Admin to make the change.
          </Banner>
        </div>
      )}

      {inWindow && !isSuperAdmin && (
        <div style={{ marginBottom: 16 }}>
          <Banner tone="info">
            Your change is saved for a Super Admin to approve. Until then the entry
            keeps its current figures in stock, the dashboard and reports.
          </Banner>
        </div>
      )}

      <div className="formgrid">
        <TextInput label="Recorded on" value={date(row?.Collection_Date)} disabled />
        <TextInput
          label="Total waste collected (kg)"
          required
          type="number"
          min="0"
          step="0.01"
          value={total}
          disabled={!inWindow}
          hint={`Currently ${kg(originalTotal)}`}
          onChange={(e) => setTotal(e.target.value)}
        />
      </div>

      {needsCategories ? (
        <div style={{ marginTop: 18 }}>
          <Banner tone="warn">
            The total has changed, so the category break-up no longer adds up to it.
            Re-enter it below — the edit cannot be submitted until the categories
            match {kg(nextTotal)} exactly.
          </Banner>
          <CategorySheet
            title="Categories of waste"
            subtitle={`Must add up to ${kg(nextTotal)}`}
            totalKg={nextTotal}
            onSubmit={(lines) => save(lines)}
            onCancel={onClose}
          />
        </div>
      ) : (
        <div className="formactions">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => save()}
            disabled={!inWindow || !valid || !changed || saving}
          >
            {isSuperAdmin ? "Save change" : "Send for approval"}
          </Button>
        </div>
      )}

      {inWindow && valid && !changed && !needsCategories && (
        <p className="u-small u-muted" style={{ textAlign: "right", marginTop: 8 }}>
          Change the total to enable this button.
        </p>
      )}
    </Modal>
  );
}
