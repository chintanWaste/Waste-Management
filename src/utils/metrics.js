/**
 * Pure functions that turn Google Sheet rows into the dashboard's figures.
 *
 * Every one of these returns null (not 0) when there is nothing to measure, so
 * the screen can show a dash rather than a misleading zero.
 */

import { parseDate } from "./format";
import { inPeriod } from "./period";

export const isActive = (row) =>
  String(row.Status || "Active").toLowerCase() === "active";

export const kgOf = (row, column) => {
  const n = Number(row[column]);
  return Number.isFinite(n) ? n : 0;
};

const sum = (rows, column) => rows.reduce((total, r) => total + kgOf(r, column), 0);

/** null when the list is empty, so the UI shows "—" instead of "0". */
const sumOrNull = (rows, column) => (rows.length ? sum(rows, column) : null);

/** Count of active rows, or null when the tab is empty. */
export const countActive = (rows) =>
  rows.length ? rows.filter(isActive).length : null;

export const countBy = (rows, column) => {
  const out = {};
  for (const row of rows.filter(isActive)) {
    const key = row[column] || "Unspecified";
    out[key] = (out[key] || 0) + 1;
  }
  return out;
};

/* -------------------------------------------------------- collected waste */

/** Each inward tab keeps its total in a differently named column. */
export const INWARD_SOURCES = [
  { key: "MMRF", tab: "inwardMmrf", amount: "Waste_Collected_Kg", date: "Collection_Date" },
  { key: "RRR", tab: "inwardRrr", amount: "Total_Waste_Collected_Kg", date: "Collection_Date" },
  { key: "BWG", tab: "inwardBwg", amount: "Waste_Collected_Kg", date: "Collection_Date" },
  { key: "SPECIAL", tab: "inwardSpecial", amount: "Total_Waste_Collected_Kg", date: "Collection_Date" },
];

/** Rows of one inward tab that fall inside the period and pass the filters. */
export function filterInward(rows, source, { range, area }) {
  return rows.filter((r) => {
    if (!isActive(r)) return false;
    if (range && !inPeriod(r[source.date], range)) return false;
    if (area && r.Area && r.Area !== area) return false;
    return true;
  });
}

/** { MMRF: kg, RRR: kg, BWG: kg, SPECIAL: kg } — null when a tab is empty. */
export function collectedBySource(sheets, filters) {
  const out = {};
  for (const source of INWARD_SOURCES) {
    const rows = filterInward(sheets[source.tab] || [], source, filters);
    out[source.key] = rows.length ? sum(rows, source.amount) : null;
  }
  return out;
}

export function totalCollected(bySource) {
  const values = Object.values(bySource).filter((v) => v !== null);
  return values.length ? values.reduce((a, b) => a + b, 0) : null;
}

/** Donut data; drops sources with nothing collected. */
export function sourceMix(bySource) {
  const labels = {
    BWG: "BWGs",
    MMRF: "MMRF / RRR Centres",
    RRR: "RRR on Wheels",
    SPECIAL: "Special collection",
  };
  return Object.entries(bySource)
    .filter(([, value]) => value)
    .map(([key, value]) => ({ key, label: labels[key], value }));
}

/** Daily line chart: one point per date that has any collection. */
export function collectionTrend(sheets, filters) {
  const byDate = new Map();

  for (const source of INWARD_SOURCES) {
    for (const row of filterInward(sheets[source.tab] || [], source, filters)) {
      const d = parseDate(row[source.date]);
      if (!d) continue;
      const key = d.toISOString().slice(0, 10);
      if (!byDate.has(key)) byDate.set(key, { date: key, BWG: 0, MMRF: 0, RRR: 0, SPECIAL: 0 });
      byDate.get(key)[source.key] += kgOf(row, source.amount);
    }
  }

  return [...byDate.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((point) => ({
      ...point,
      label: `${point.date.slice(8, 10)} ${
        ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
          [Number(point.date.slice(5, 7)) - 1]
      }`,
    }));
}

/* ------------------------------------------------------------ categorised */

/** Stacked column of waste streams by month, from the categorised entries. */
export function streamsByMonth(entryCategories, { range }) {
  const byMonth = new Map();

  for (const row of entryCategories) {
    if (range && !inPeriod(row.Collection_Date, range)) continue;
    const d = parseDate(row.Collection_Date);
    if (!d) continue;

    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!byMonth.has(key)) {
      byMonth.set(key, {
        key,
        label: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()],
        Wet: 0, Dry: 0, Sanitary: 0, "Special Care": 0, Others: 0,
      });
    }
    const bucket = byMonth.get(key);
    const stream = row.Waste_Stream;
    if (stream in bucket) bucket[stream] += kgOf(row, "Quantity_Kg");
  }

  return [...byMonth.values()].sort((a, b) => a.key.localeCompare(b.key));
}

/* ------------------------------------------------------------------ BWGs */

/** Top 10 BWGs by kg collected, named from the BWGs tab. */
export function topBwgs(inwardBwg, bwgs, filters, limit = 10) {
  const names = Object.fromEntries(bwgs.map((b) => [b.BWG_Code, b.BWG_Name]));
  const totals = new Map();

  const source = INWARD_SOURCES.find((s) => s.key === "BWG");
  for (const row of filterInward(inwardBwg, source, filters)) {
    const code = row.BWG_Code;
    if (!code) continue;
    totals.set(code, (totals.get(code) || 0) + kgOf(row, "Waste_Collected_Kg"));
  }

  return [...totals.entries()]
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([code, value]) => ({ label: names[code] || code, value }));
}

/** Kg collected from BWGs in each area. */
export function bwgByArea(inwardBwg, filters) {
  const source = INWARD_SOURCES.find((s) => s.key === "BWG");
  const rows = filterInward(inwardBwg, { ...source }, { ...filters, area: "" });
  if (!rows.length) return null;

  const out = {};
  for (const row of rows) {
    const area = row.Area || "Unspecified";
    out[area] = (out[area] || 0) + kgOf(row, "Waste_Collected_Kg");
  }
  return out;
}

/* -------------------------------------------------------------- dispatch */

export function dispatchTotals(dispatch, { range, area }) {
  const rows = dispatch.filter((r) => {
    if (!isActive(r)) return false;
    if (range && !inPeriod(r.Dispatch_Date, range)) return false;
    if (area && r.Area && r.Area !== area) return false;
    return true;
  });

  if (!rows.length) return { total: null, byPurpose: {}, diverted: null };

  const byPurpose = {};
  for (const row of rows) {
    const purpose = row.Purpose || "Unspecified";
    byPurpose[purpose] = (byPurpose[purpose] || 0) + kgOf(row, "Total_Quantity_Kg");
  }

  const total = sum(rows, "Total_Quantity_Kg");
  const diverted = total - (byPurpose.Disposal || 0);
  return { total, byPurpose, diverted };
}

/** Kg dispatched for anything other than Disposal, over kg collected. */
export function diversionRate(diverted, collected) {
  if (!collected || diverted === null) return null;
  return (diverted / collected) * 100;
}

/* ---------------------------------------------------------- certificates */

/**
 * Certificate-required kg dispatched, minus kg certified (section 6.2).
 * MMRF dispatches are excluded — they are not tracked for certificates.
 */
export function certificatesPending(dispatchLines, dispatch, vendorCertificates) {
  const tracked = new Set(
    dispatch.filter((d) => isActive(d) && d.Source_Type !== "MMRF").map((d) => d.Dispatch_Code)
  );

  const required = dispatchLines.filter(
    (l) => l.Certificate_Requirement === "Required" && tracked.has(l.Dispatch_Code)
  );
  if (!required.length && !vendorCertificates.length) return null;

  const dispatched = sum(required, "Quantity_Kg");
  const certified = sum(vendorCertificates.filter(isActive), "Quantity_Certified_Kg");
  return Math.max(0, dispatched - certified);
}

/* --------------------------------------------------------------- stock */

/** Collected minus dispatched, per source type. Never shown below zero. */
export function currentStock(sheets) {
  const collected = collectedBySource(sheets, {});
  const byPurpose = {};

  for (const row of sheets.dispatch || []) {
    if (!isActive(row)) continue;
    const key = row.Source_Type || "Unspecified";
    byPurpose[key] = (byPurpose[key] || 0) + kgOf(row, "Total_Quantity_Kg");
  }

  const out = {};
  let any = false;
  for (const [key, value] of Object.entries(collected)) {
    if (value === null && !byPurpose[key]) { out[key] = null; continue; }
    any = true;
    out[key] = Math.max(0, (value || 0) - (byPurpose[key] || 0));
  }
  return { bySource: out, total: any ? Object.values(out).reduce((a, b) => a + (b || 0), 0) : null };
}
