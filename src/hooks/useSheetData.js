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

  return { rows, loading, error, reload: () => load(true), addRow };
}
