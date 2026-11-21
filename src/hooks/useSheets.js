import { useCallback, useEffect, useState } from "react";
import { TABS, isDriveConfigured } from "../config/driveSchema";
import { readTab } from "../services/sheetsApi";

/**
 * Load several tabs at once, keyed by their TABS key.
 *
 * Returns { data: { vendors: [...], bwgs: [...] }, loading, error, reload }.
 * A tab that fails to load comes back as [] rather than breaking the page.
 */
export function useSheets(keys) {
  const signature = keys.join(",");
  const [data, setData] = useState(() =>
    Object.fromEntries(keys.map((k) => [k, []]))
  );
  const [loading, setLoading] = useState(isDriveConfigured());
  const [error, setError] = useState("");

  const load = useCallback(
    async (force = false) => {
      const list = signature.split(",").filter(Boolean);

      if (!isDriveConfigured()) {
        setLoading(false);
        setError("No Google Sheet is connected. Set VITE_SHEET_ID in app/.env.");
        return;
      }

      setLoading(true);
      setError("");
      try {
        const rows = await Promise.all(
          list.map((key) => readTab(TABS[key].tab, { force }).catch(() => []))
        );
        setData(Object.fromEntries(list.map((key, i) => [key, rows[i]])));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [signature]
  );

  useEffect(() => { load(false); }, [load]);

  return { data, loading, error, reload: () => load(true) };
}

/** Active rows only — the common case for dropdowns. */
export const active = (rows = []) =>
  rows.filter((r) => String(r.Status || "Active").toLowerCase() === "active");

/** Build a { code: row } index. */
export const indexBy = (rows = [], column) =>
  Object.fromEntries(rows.filter((r) => r[column]).map((r) => [r[column], r]));
