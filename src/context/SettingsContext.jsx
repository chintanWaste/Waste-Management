import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import defaults from "../config/defaultLists.json";
import { SETTINGS, isDriveConfigured } from "../config/driveSchema";
import { readTab } from "../services/sheetsApi";

const SettingsContext = createContext(null);

/** Every list the application knows about, with its description and spec reference. */
export const LIST_CATALOGUE = defaults.lists;

/**
 * Settings for the whole application.
 *
 * A value comes from the Settings tab of the Google Sheet when a row exists for
 * it, and from the built-in defaults in defaultLists.json when it does not. So
 * a brand-new Sheet works straight away, Chintan can override any list from the
 * Settings page, and a dropdown is never silently empty.
 */
export function SettingsProvider({ children }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(isDriveConfigured());
  const [error, setError] = useState("");

  const load = useCallback(async (force = false) => {
    if (!isDriveConfigured()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      setRows(await readTab(SETTINGS.tab, { force }));
    } catch (err) {
      setError(err.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(false); }, [load]);

  const value = useMemo(() => {
    const sheet = Object.fromEntries(
      rows
        .filter((r) => r.Setting_Key)
        .map((r) => [String(r.Setting_Key).trim(), String(r.Setting_Value ?? "").trim()])
        .filter(([, v]) => v !== "")
    );

    const splitPipes = (text) =>
      String(text || "")
        .split("|")
        .map((s) => s.trim())
        .filter(Boolean);

    /**
     * A dropdown list. The Sheet wins when it has a non-empty row; otherwise
     * the built-in default is used. A list marked `fixed` always uses the
     * built-in values, because the code or the specification depends on them.
     */
    const list = (key) => {
      const builtIn = defaults.lists[key];
      if (builtIn?.fixed) return builtIn.values;
      if (sheet[key]) return splitPipes(sheet[key]);
      return builtIn?.values || [];
    };

    /** Where a list's current values come from — shown on the Settings page. */
    const listSource = (key) => {
      const builtIn = defaults.lists[key];
      if (builtIn?.fixed) return "fixed";
      if (sheet[key]) return "sheet";
      return "default";
    };

    const number = (key, fallback = null) => {
      const fromSheet = Number(sheet[key]);
      if (Number.isFinite(fromSheet) && sheet[key] !== undefined) return fromSheet;
      const builtIn = defaults.numbers[key];
      return builtIn === undefined ? fallback : builtIn;
    };

    const text = (key) => sheet[key] ?? defaults.text[key] ?? "";

    return {
      raw: sheet,
      rows,
      defaults,
      catalogue: defaults.lists,
      list,
      listSource,
      number,
      text,
      /** True when the Sheet itself carries a value for this key. */
      hasSheetValue: (key) => key in sheet,
      loading,
      error,
      reload: () => load(true),
    };
  }, [rows, loading, error, load]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside <SettingsProvider>");
  return ctx;
}
