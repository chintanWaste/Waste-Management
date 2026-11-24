import { useCallback, useEffect, useState } from "react";
import { readTab } from "../services/sheetsApi";

/**
 * Load one Google Sheet tab.
 * Returns { rows, loading, error, reload, addRow }.
 */
export function useSheetData(tabName, { enabled = true } = {}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState("");

  const load = useCallback(
    async (force = false) => {
      if (!enabled || !tabName) return;
      setLoading(true);
      setError("");
      try {
        setRows(await readTab(tabName, { force }));
      } catch (err) {
        setError(err.message);
        setRows([]);
      } finally {
        setLoading(false);
      }
    },
    [tabName, enabled]
  );

  useEffect(() => {
    load(false);
  }, [load]);

  /**
   * Show a just-created row straight away.
   *
   * The Sheet CSV endpoint can lag a second or two behind a write, so a row
   * that was definitely saved would otherwise be missing from the table until
   * the next refresh. The reload that follows replaces it with the real one.
   */
  const addRow = useCallback((row) => {
    if (!row) return;
    setRows((prev) => [row, ...prev]);
  }, []);

  /**
   * Drop a just-deleted row straight away.
   *
   * Same reason as addRow: the Sheet's CSV endpoint can keep serving the
   * pre-delete copy for a second or two, so without this a record the user
   * has just deleted stays on screen and looks as though nothing happened.
   */
  const removeRow = useCallback((idColumn, id) => {
    if (!idColumn || id === undefined || id === null) return;
    setRows((prev) => prev.filter((r) => String(r[idColumn]) !== String(id)));
  }, []);

  return { rows, loading, error, reload: () => load(true), addRow, removeRow };
}
