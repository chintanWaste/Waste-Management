import { useCallback, useEffect, useMemo, useState } from "react";
import { TABS, isDriveConfigured } from "../config/driveSchema";
import { readTab } from "../services/sheetsApi";
import * as m from "../utils/metrics";
import { resolvePeriod } from "../utils/period";

/** Every tab the dashboard needs, by its key in TABS. */
const NEEDED = [
  "bwgs", "vendors", "mmrfs", "vehicles", "drivers",
  "inwardMmrf", "inwardRrr", "inwardBwg", "inwardSpecial",
  "entryCategories", "dispatch", "dispatchLines",
  "vendorCertificates", "alerts",
];

const EMPTY = Object.fromEntries(NEEDED.map((k) => [k, []]));

/**
 * Loads the tabs the dashboard reads and derives every figure on screen.
 * Nothing is hard-coded: an empty Sheet produces nulls, which render as "—".
 */
export function useDashboardData(filters) {
  const [sheets, setSheets] = useState(EMPTY);
  const [loading, setLoading] = useState(isDriveConfigured());
  const [error, setError] = useState("");

  const load = useCallback(async (force = false) => {
    if (!isDriveConfigured()) {
      setLoading(false);
      setError("No Google Sheet is connected. Set VITE_SHEET_ID in app/.env.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const results = await Promise.all(
        NEEDED.map((key) => readTab(TABS[key].tab, { force }).catch(() => []))
      );
      setSheets(Object.fromEntries(NEEDED.map((key, i) => [key, results[i]])));
    } catch (err) {
      setError(err.message);
      setSheets(EMPTY);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(false); }, [load]);

  const metrics = useMemo(() => {
    const range = resolvePeriod(filters);
    const scope = { range, area: filters.area };

    const bySource = m.collectedBySource(sheets, scope);
    const collected = m.totalCollected(bySource);
    const dispatched = m.dispatchTotals(sheets.dispatch, scope);
    const stock = m.currentStock(sheets);

    return {
      range,
      summary: {
        bwgs: { total: m.countActive(sheets.bwgs), byArea: m.countBy(sheets.bwgs, "Area") },
        vendors: { total: m.countActive(sheets.vendors), byType: m.countBy(sheets.vendors, "Vendor_Type") },
        mmrfs: { total: m.countActive(sheets.mmrfs), byArea: m.countBy(sheets.mmrfs, "Area") },
        fleet: { vehicles: m.countActive(sheets.vehicles), drivers: m.countActive(sheets.drivers) },
        collected,
        collectedBySource: bySource,
        bwgByArea: m.bwgByArea(sheets.inwardBwg, scope),
        dispatched: dispatched.total,
        dispatchByPurpose: dispatched.byPurpose,
        stock: stock.total,
        stockBySource: stock.bySource,
        diversion: m.diversionRate(dispatched.diverted, collected),
        certificatesPending: m.certificatesPending(
          sheets.dispatchLines, sheets.dispatch, sheets.vendorCertificates
        ),
      },
      charts: {
        trend: m.collectionTrend(sheets, scope),
        sourceMix: m.sourceMix(bySource),
        streams: m.streamsByMonth(sheets.entryCategories, scope),
        topBwgs: m.topBwgs(sheets.inwardBwg, sheets.bwgs, scope),
      },
      alerts: sheets.alerts
        .filter((a) => String(a.Status || "Open").toLowerCase() !== "closed")
        .map((a) => ({
          id: a.Alert_Id,
          severity: (a.Severity || "info").toLowerCase(),
          title: a.Title || a.Alert_Type,
          message: a.Message,
          raisedOn: a.Raised_On,
        })),
    };
  }, [sheets, filters]);

  return { ...metrics, loading, error, reload: () => load(true) };
}
