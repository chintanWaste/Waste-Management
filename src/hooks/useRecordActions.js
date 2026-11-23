import { useCallback, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { deleteRecord } from "../services/onboardingService";

/**
 * The View / Edit / Delete state every directory table needs.
 *
 * Keeps the four pieces that were otherwise copied onto each page: which row
 * is being viewed, which is being edited, which is awaiting a delete
 * confirmation, and which is mid-delete. Deleting removes the row from its
 * tab after the Apps Script archives a full copy to Deleted_Items, and the
 * confirmation itself is rendered by the page with <ConfirmDialog>.
 *
 *   const a = useRecordActions({ tab: BWGS, nameKey: "BWG_Name", onDone: reload });
 *
 * `tab` is a TABS entry from config/driveSchema.js.
 */
export function useRecordActions({ tab, nameKey, noun = "record", onDone }) {
  const { user } = useAuth();
  const toast = useToast();

  const [viewing, setViewing] = useState(null);
  const [editing, setEditing] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const [removing, setRemoving] = useState("");

  const idOf = (row) => row?.[tab.idColumn];
  const nameOf = (row) => (nameKey ? row?.[nameKey] : "") || idOf(row) || "";

  const confirmDelete = useCallback(async () => {
    const row = confirming;
    if (!row) return;

    const id = row[tab.idColumn];
    const label = (nameKey ? row[nameKey] : "") || id;

    setRemoving(String(id));
    try {
      await deleteRecord({ tab, id, label, user });
      toast.success(`${id} deleted`, `${label} has been removed from the sheet and archived.`);
      setConfirming(null);
      onDone?.();
    } catch (err) {
      toast.error(`Could not delete the ${noun}`, err.message);
    } finally {
      setRemoving("");
    }
  }, [confirming, tab, nameKey, noun, user, toast, onDone]);

  return {
    viewing, setViewing,
    editing, setEditing,
    confirming, setConfirming,
    removing,
    confirmDelete,
    idOf, nameOf,
    /** Spread onto <ConfirmDialog> — the page supplies nothing but the noun. */
    confirmProps: {
      open: Boolean(confirming),
      title: `Delete this ${noun}?`,
      subtitle: confirming ? `${idOf(confirming)} — ${nameOf(confirming)}` : "",
      message: confirming
        ? `${nameOf(confirming)} will be removed from the sheet.`
        : "",
      note:
        "The row is removed from the sheet. A full copy is archived to " +
        "Deleted_Items first, so it can still be restored.",
      confirmLabel: `Delete ${noun}`,
      busy: Boolean(removing),
      busyText: "Deleting and archiving…",
      onConfirm: confirmDelete,
      onCancel: () => setConfirming(null),
    },
  };
}
