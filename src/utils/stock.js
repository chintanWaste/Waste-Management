/**
 * Stock (specification section 13 and the formula in 5.1).
 *
 * Stock is kept separately for each source type and is never mixed. For a date
 * range the screen shows four columns: opening (at the start date), collected
 * and dispatched (within the range) and closing (at the end date).
 *
 * MMRF stock is a total per centre, with no categories. BWG category stock
 * comes from the daily vendor characterisation, pooled across all vendors.
 */

import { parseDate } from "./format";

const num = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const live = (row) => String(row.Status || "Active").toLowerCase() !== "deleted";

const before = (value, boundary) => {
  const d = parseDate(value);
  return d && boundary ? d < parseDate(boundary) : false;
};

const within = (value, from, to) => {
  const d = parseDate(value);
  if (!d) return false;
  if (from && d < parseDate(from)) return false;
  if (to && d > parseDate(to)) return false;
  return true;
};

const onOrBefore = (value, boundary) => {
  const d = parseDate(value);
  return d && boundary ? d <= parseDate(boundary) : false;
};

/**
 * Category-level stock for one categorised source type.
 *
 * Returns a flat list of { categoryId, name, group, stream, opening, collected,
 * dispatched, closing } plus an "Uncategorised" figure: inward totals whose
 * entries have not been broken into categories and so cannot be dispatched.
 */
export function categoryStock({
  sourceType, entryCategories, dispatch, dispatchLines, from, to,
}) {
  const lines = entryCategories.filter((l) => l.Source_Type === sourceType);

  const dispatchDates = new Map(
    dispatch
      .filter((d) => live(d) && d.Source_Type === sourceType)
      .map((d) => [d.Dispatch_Code, d.Dispatch_Date])
  );

  const rows = new Map();

  const touch = (id, line) => {
    if (!rows.has(id)) {
      rows.set(id, {
        categoryId: id,
        name: line.Waste_Category || id,
        group: line.Material_Group || "Unspecified",
        stream: line.Waste_Stream || "Unspecified",
        opening: 0, collected: 0, dispatched: 0,
      });
    }
    return rows.get(id);
  };

  for (const line of lines) {
    const row = touch(line.Category_Id, line);
    const kg = num(line.Quantity_Kg);
    if (before(line.Collection_Date, from)) row.opening += kg;
    if (within(line.Collection_Date, from, to)) row.collected += kg;
  }

  for (const line of dispatchLines) {
    const when = dispatchDates.get(line.Dispatch_Code);
    if (!when) continue;
    const row = touch(line.Category_Id, line);
    const kg = num(line.Quantity_Kg);
    if (before(when, from)) row.opening -= kg;
    if (within(when, from, to)) row.dispatched += kg;
  }

  return [...rows.values()]
    .map((r) => ({ ...r, closing: r.opening + r.collected - r.dispatched }))
    .filter((r) => r.opening || r.collected || r.dispatched || r.closing);
}

/** The flat category rows nested as stream > material group > category. */
export function groupStock(rows) {
  const streams = new Map();

  for (const row of rows) {
    if (!streams.has(row.stream)) {
      streams.set(row.stream, {
        name: row.stream, opening: 0, collected: 0, dispatched: 0, closing: 0,
        groups: new Map(),
      });
    }
    const stream = streams.get(row.stream);

    if (!stream.groups.has(row.group)) {
      stream.groups.set(row.group, {
        name: row.group, opening: 0, collected: 0, dispatched: 0, closing: 0, items: [],
      });
    }
    const group = stream.groups.get(row.group);

    group.items.push(row);
    for (const key of ["opening", "collected", "dispatched", "closing"]) {
      group[key] += row[key];
      stream[key] += row[key];
    }
  }

  return [...streams.values()].map((s) => ({ ...s, groups: [...s.groups.values()] }));
}

/**
 * Inward that has been recorded but not categorised, so it cannot be dispatched
 * by category (section 5.1).
 */
export function uncategorised({ sourceType, inwardRows, amountColumn, idColumn, entryCategories, from, to }) {
  const categorised = new Set(
    entryCategories.filter((l) => l.Source_Type === sourceType).map((l) => l.Entry_Ref_Id)
  );

  let opening = 0;
  let collected = 0;

  for (const row of inwardRows) {
    if (!live(row)) continue;
    if (categorised.has(row[idColumn])) continue;
    const kg = num(row[amountColumn]);
    if (before(row.Collection_Date, from)) opening += kg;
    if (within(row.Collection_Date, from, to)) collected += kg;
  }

  return { opening, collected, dispatched: 0, closing: opening + collected };
}

/** MMRF stock is a total per centre, with no categories (section 13.2). */
export function mmrfStock({ inwardMmrf, dispatch, from, to }) {
  const rows = new Map();

  const touch = (code) => {
    if (!rows.has(code)) {
      rows.set(code, { code, opening: 0, collected: 0, dispatched: 0 });
    }
    return rows.get(code);
  };

  for (const row of inwardMmrf) {
    if (!live(row) || !row.MMRF_Code) continue;
    const entry = touch(row.MMRF_Code);
    const kg = num(row.Waste_Collected_Kg);
    if (before(row.Collection_Date, from)) entry.opening += kg;
    if (within(row.Collection_Date, from, to)) entry.collected += kg;
  }

  for (const row of dispatch) {
    if (!live(row) || row.Source_Type !== "MMRF" || !row.Source_Ref) continue;
    const entry = touch(row.Source_Ref);
    const kg = num(row.Total_Quantity_Kg);
    if (before(row.Dispatch_Date, from)) entry.opening -= kg;
    if (within(row.Dispatch_Date, from, to)) entry.dispatched += kg;
  }

  return [...rows.values()].map((r) => ({ ...r, closing: r.opening + r.collected - r.dispatched }));
}

/**
 * Stock available to dispatch on a date (section 5.1):
 * categorised inward up to the day BEFORE the dispatch date, minus all
 * dispatches up to and including it. Returns { categoryId: kg }.
 */
export function availableOn({ sourceType, dispatchDate, entryCategories, dispatch, dispatchLines }) {
  const dayBefore = new Date(parseDate(dispatchDate));
  dayBefore.setDate(dayBefore.getDate() - 1);
  const cutoff = dayBefore.toISOString().slice(0, 10);

  const available = {};

  for (const line of entryCategories) {
    if (line.Source_Type !== sourceType) continue;
    if (!onOrBefore(line.Collection_Date, cutoff)) continue;
    available[line.Category_Id] = (available[line.Category_Id] || 0) + num(line.Quantity_Kg);
  }

  const dates = new Map(
    dispatch
      .filter((d) => live(d) && d.Source_Type === sourceType)
      .map((d) => [d.Dispatch_Code, d.Dispatch_Date])
  );

  for (const line of dispatchLines) {
    const when = dates.get(line.Dispatch_Code);
    if (!when || !onOrBefore(when, dispatchDate)) continue;
    available[line.Category_Id] = (available[line.Category_Id] || 0) - num(line.Quantity_Kg);
  }

  for (const key of Object.keys(available)) {
    available[key] = Number(available[key].toFixed(2));
    if (available[key] <= 0) delete available[key];
  }

  return available;
}

/** MMRF total available to dispatch on a date, per centre. */
export function mmrfAvailableOn({ mmrfCode, dispatchDate, inwardMmrf, dispatch }) {
  const dayBefore = new Date(parseDate(dispatchDate));
  dayBefore.setDate(dayBefore.getDate() - 1);
  const cutoff = dayBefore.toISOString().slice(0, 10);

  let total = 0;
  for (const row of inwardMmrf) {
    if (!live(row) || row.MMRF_Code !== mmrfCode) continue;
    if (onOrBefore(row.Collection_Date, cutoff)) total += num(row.Waste_Collected_Kg);
  }
  for (const row of dispatch) {
    if (!live(row) || row.Source_Type !== "MMRF" || row.Source_Ref !== mmrfCode) continue;
    if (onOrBefore(row.Dispatch_Date, dispatchDate)) total -= num(row.Total_Quantity_Kg);
  }

  return Number(Math.max(0, total).toFixed(2));
}
