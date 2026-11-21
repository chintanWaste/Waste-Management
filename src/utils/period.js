/** Turns a dashboard period preset into a from–to range (section 6.1). */

import { parseDate, toInputDate } from "./format";

const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0);

/** Indian financial year runs 1 April – 31 March. */
function financialYearRange(d) {
  const startYear = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return [new Date(startYear, 3, 1), new Date(startYear + 1, 2, 31)];
}

function quarterRange(d) {
  const q = Math.floor(d.getMonth() / 3);
  return [new Date(d.getFullYear(), q * 3, 1), new Date(d.getFullYear(), q * 3 + 3, 0)];
}

export function resolvePeriod({ period, from, to }) {
  const now = new Date();

  switch (period) {
    case "last-month": {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return { from: startOfMonth(prev), to: endOfMonth(prev) };
    }
    case "this-quarter": {
      const [a, b] = quarterRange(now);
      return { from: a, to: b };
    }
    case "this-fy": {
      const [a, b] = financialYearRange(now);
      return { from: a, to: b };
    }
    case "custom":
      return {
        from: parseDate(from) || startOfMonth(now),
        to: parseDate(to) || now,
      };
    case "this-month":
    default:
      return { from: startOfMonth(now), to: endOfMonth(now) };
  }
}

/** Is a row's date inside the range? Rows with no date are excluded. */
export function inPeriod(value, range) {
  const d = parseDate(value);
  if (!d || !range) return false;
  return d >= range.from && d <= range.to;
}

export const periodLabel = (range) =>
  `${toInputDate(range.from)} to ${toInputDate(range.to)}`;
