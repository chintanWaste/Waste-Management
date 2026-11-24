import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Power } from "lucide-react";
import Badge from "../../components/common/Badge";
import Button from "../../components/common/Button";
import Card from "../../components/common/Card";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import DataTable from "../../components/common/DataTable";
import Modal from "../../components/common/Modal";
import PageHeader from "../../components/common/PageHeader";
import { rowActionsColumn } from "../../components/common/rowActions";
import { WASTE_CATEGORIES, isWriteConfigured } from "../../config/driveSchema";
import { useToast } from "../../context/ToastContext";
import { useSheetData } from "../../hooks/useSheetData";
import {
  categoryUsage, deleteCategory, setCategoryStatus,
} from "../../services/categoryService";
import WasteCategoryForm from "./WasteCategoryForm";

const isActive = (row) => String(row.Status || "Active").toLowerCase() === "active";

/** Section 17.3 — the category master, read live from the Waste_Categories tab. */
export default function WasteCategoriesPage() {
  const toast = useToast();
  const canSave = isWriteConfigured();

  const { rows, loading, error, reload, addRow, removeRow } =
    useSheetData(WASTE_CATEGORIES.tab);

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const [usage, setUsage] = useState(null); // null while it is still being counted
  const [removing, setRemoving] = useState("");

  /** The groups and streams already in the master, for the form's suggestions. */
  const streams = useMemo(
    () => [...new Set(rows.map((r) => r.Waste_Stream).filter(Boolean))],
    [rows]
  );
  const groups = useMemo(
    () => [...new Set(rows.map((r) => r.Material_Group).filter(Boolean))].sort(),
    [rows]
  );
  const required = rows.filter((r) => r.Certificate_Requirement === "Required").length;

  const handleCreated = useCallback(
    ({ row }) => {
      setOpen(false);
      addRow(row);
      reload();
    },
    [addRow, reload]
  );

  const handleUpdated = useCallback(() => {
    setEditing(null);
    reload();
  }, [reload]);

  /**
   * Count what a category is used by, as soon as it is picked for deletion.
   *
   * Asked here rather than only when Delete is pressed, so the dialog can say
   * up front that a category in use cannot be destroyed, instead of offering a
   * button that is certain to fail.
   */
  useEffect(() => {
    if (!confirming) {
      setUsage(null);
      return undefined;
    }

    let current = true;
    setUsage(null);
    categoryUsage({ categoryId: confirming[WASTE_CATEGORIES.idColumn] })
      .then((counts) => { if (current) setUsage(counts); })
      .catch((err) => { if (current) setUsage({ total: 0, error: err.message }); });

    return () => { current = false; };
  }, [confirming]);

  const toggleStatus = useCallback(
    async (row) => {
      const id = row[WASTE_CATEGORIES.idColumn];
      const next = isActive(row) ? "Inactive" : "Active";
      try {
        await setCategoryStatus({ categoryId: id, status: next });
        toast.success(
          `${row.Waste_Category} is now ${next.toLowerCase()}`,
          next === "Inactive"
            ? "It stays in past entries and reports, but is no longer offered in new ones."
            : "It can be used in new inward entries and dispatches again."
        );
        reload();
      } catch (err) {
        toast.error("Could not change the status", err.message);
      }
    },
    [reload, toast]
  );

  const confirmDelete = useCallback(async () => {
    const row = confirming;
    if (!row) return;

    const id = row[WASTE_CATEGORIES.idColumn];
    setRemoving(id);
    try {
      await deleteCategory({ row });
      // Dropped here rather than by refetching: the CSV endpoint can still be
      // serving the pre-delete copy, which would put the row straight back.
      removeRow(WASTE_CATEGORIES.idColumn, id);
      setConfirming(null);
      toast.success(`${id} deleted`, `${row.Waste_Category} has been removed and archived.`);
    } catch (err) {
      toast.error("Could not delete the category", err.message);
    } finally {
      setRemoving("");
    }
  }, [confirming, removeRow, toast]);

  /**
   * Deactivate straight from the delete dialog, which is the real answer.
   *
   * Set outright rather than toggled: a category can already be inactive and
   * still be in use, and toggling there would switch it back on — the opposite
   * of what the button offers.
   */
  const deactivateFromDialog = useCallback(async () => {
    const row = confirming;
    if (!row) return;

    const id = row[WASTE_CATEGORIES.idColumn];
    try {
      await setCategoryStatus({ categoryId: id, status: "Inactive" });
      setConfirming(null);
      toast.success(
        `${row.Waste_Category} is now inactive`,
        "It stays in past entries and reports, but is no longer offered in new ones."
      );
      reload();
    } catch (err) {
      toast.error("Could not deactivate the category", err.message);
    }
  }, [confirming, reload, toast]);

  const counting = Boolean(confirming) && !usage;
  const blocked = Boolean(usage && usage.total > 0);
  /** Where it is used could not be read, so deleting cannot be allowed. */
  const unknown = Boolean(usage?.error);
  /** In use and already deactivated — there is nothing left for the dialog to do. */
  const alreadyInactive = blocked && confirming && !isActive(confirming);

  const usageMessage = (() => {
    if (counting) return "Checking whether any entries or dispatches use this category…";
    if (unknown) {
      return (
        "Whether this category is used anywhere could not be checked, so it cannot be " +
        `deleted: ${usage.error}`
      );
    }
    if (blocked) {
      const where = [
        usage.entries && `${usage.entries} inward line${usage.entries === 1 ? "" : "s"}`,
        usage.dispatches && `${usage.dispatches} dispatch line${usage.dispatches === 1 ? "" : "s"}`,
      ].filter(Boolean).join(" and ");

      return (
        `It is recorded against ${where}, so deleting it would leave those figures ` +
        "pointing at a category that no longer exists." +
        (alreadyInactive
          ? " It is already deactivated, so it is not being offered in new entries either."
          : "")
      );
    }
    return (
      `${confirming?.Waste_Category} has never been used in an entry or a dispatch, ` +
      "so it can be removed from the master."
    );
  })();

  const columns = [
    { key: "Serial_No", header: "S. No", align: "right" },
    { key: "Waste_Stream", header: "Stream" },
    { key: "Material_Group", header: "Material Group" },
    { key: "Waste_Category", header: "Waste Category" },
    { key: "Unit", header: "Unit" },
    {
      key: "Certificate_Requirement",
      header: "Certificate",
      render: (r) =>
        r.Certificate_Requirement ? (
          <Badge tone={r.Certificate_Requirement === "Required" ? "info" : "muted"}>
            {r.Certificate_Requirement}
          </Badge>
        ) : "—",
    },
    {
      key: "Status",
      header: "Status",
      render: (r) => <Badge>{r.Status || "Active"}</Badge>,
    },
    {
      key: "status_action", header: "", sortable: false, align: "center",
      exportValue: () => "",
      render: (r) => (
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => toggleStatus(r)}
          disabled={!canSave}
          title={canSave ? "Activate or deactivate" : "Saving is not connected"}
        >
          <Power size={13} aria-hidden="true" />
          {isActive(r) ? "Deactivate" : "Activate"}
        </button>
      ),
    },
    rowActionsColumn({
      idKey: WASTE_CATEGORIES.idColumn,
      canWrite: canSave,
      busyId: removing,
      labelFor: (r) => r.Waste_Category || r[WASTE_CATEGORIES.idColumn],
      onEdit: setEditing,
      onDelete: setConfirming,
    }),
  ];

  /** A dash rather than a zero while the tab is empty or still loading. */
  const tile = (value) => (loading || !rows.length ? "—" : value);

  return (
    <>
      <PageHeader
        title="Waste Categories"
        description="The single category master used across inward entry, stock, dispatch, certificates, the dashboard and reports. A category already used in entries cannot be deleted — deactivate it instead."
        actions={
          <Button onClick={() => setOpen(true)} disabled={!canSave}
            title={canSave ? "Add a category to the master" : "Saving is not connected"}>
            <Plus size={15} aria-hidden="true" />
            Add category
          </Button>
        }
      />

      <div className="stats" style={{ marginBottom: 16 }}>
        <div className="stat">
          <div className="stat__label">Categories</div>
          <div className="stat__value">{tile(rows.length)}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Waste streams</div>
          <div className="stat__value">{tile(streams.length)}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Material groups</div>
          <div className="stat__value">{tile(groups.length)}</div>
        </div>
        <div className="stat stat--info">
          <div className="stat__label">Certificate required</div>
          <div className="stat__value">{tile(required)}</div>
        </div>
      </div>

      <Modal
        open={open}
        title="Add Waste Category"
        subtitle="It becomes available in inward entry and dispatch straight away"
        size="md"
        onClose={() => setOpen(false)}
        busy={saving}
        busyText="Saving the category to the sheet…"
      >
        <WasteCategoryForm
          rows={rows}
          streams={streams}
          groups={groups}
          onSaved={handleCreated}
          onCancel={() => setOpen(false)}
          onBusyChange={setSaving}
        />
      </Modal>

      <Modal
        open={Boolean(editing)}
        title={`Edit ${editing?.[WASTE_CATEGORIES.idColumn] || "category"}`}
        subtitle={editing?.Waste_Category}
        size="md"
        onClose={() => setEditing(null)}
        busy={saving}
        busyText="Saving changes to the sheet…"
      >
        {/* Keyed so switching rows rebuilds the form with that category's values. */}
        <WasteCategoryForm
          key={editing?.[WASTE_CATEGORIES.idColumn]}
          category={editing}
          rows={rows}
          streams={streams}
          groups={groups}
          onSaved={handleUpdated}
          onCancel={() => setEditing(null)}
          onBusyChange={setSaving}
        />
      </Modal>

      {/*
        Only the confirm button waits for the count, never the whole dialog:
        Cancel stays usable throughout, and deleteCategory checks again for
        itself, so the sheet decides the outcome rather than this screen.
      */}
      <ConfirmDialog
        open={Boolean(confirming)}
        title={blocked ? "This category is in use" : "Delete this category?"}
        subtitle={
          confirming
            ? `${confirming[WASTE_CATEGORIES.idColumn]} — ${confirming.Waste_Category}`
            : ""
        }
        message={usageMessage}
        note={
          blocked
            ? alreadyInactive
              ? "Nothing further is needed — the category is out of new entries and its history is intact."
              : "Deactivate it instead — it then stays in past entries and reports, but is not offered in new ones."
            : unknown
              ? "Close this and try again once the sheet can be read. Deactivating the category is safe either way."
              : "A full copy is archived to Deleted_Items before the row is removed, so it can still be restored."
        }
        confirmLabel={
          counting
            ? "Checking…"
            : blocked
              ? (alreadyInactive ? "Already deactivated" : "Deactivate instead")
              : "Delete category"
        }
        cancelLabel={alreadyInactive ? "Close" : "Cancel"}
        tone={blocked ? "primary" : "danger"}
        confirmDisabled={counting || unknown || alreadyInactive}
        busy={Boolean(removing)}
        busyText="Deleting and archiving…"
        onConfirm={blocked ? deactivateFromDialog : confirmDelete}
        onCancel={() => setConfirming(null)}
      />

      <Card flush>
        <DataTable
          columns={columns}
          rows={rows}
          loading={loading}
          error={error}
          onRetry={reload}
          exportName="Waste_Categories"
          emptyText="The Waste_Categories tab is empty. Import the template into the Google Sheet to load the 60 categories."
        />
      </Card>
    </>
  );
}
