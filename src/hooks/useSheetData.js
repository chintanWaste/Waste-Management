import { useCallback, useEffect, useState } from "react";
import { readTab } from "../services/sheetsApi";

/**
 * Load one Google Sheet tab.
 * Returns { rows, loading, error, reload }.
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

  return { rows, loading, error, reload: () => load(true) };
}
