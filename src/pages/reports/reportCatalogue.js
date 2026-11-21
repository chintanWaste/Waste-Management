/**
 * The six reports of section 16, and the filters each one offers.
 *
 * `source` is the source type a Supervisor must be assigned to in order to
 * generate the report. `superAdminOnly` hides the Vendor report from them.
 */

import {
  areaReport, mmrfReport, rrrReport, specialReport, stockReport, vendorReport,
} from "../../utils/reports";

export const REPORTS = [
  {
    key: "mmrf",
    label: "MMRF / RRR Centre report",
    description: "Total collected, daily trend, capacity use, dispatches and stock.",
    source: "MMRF",
    filters: ["mmrf", "area"],
    build: mmrfReport,
  },
  {
    key: "rrr",
    label: "RRR on Wheels report",
    description: "Kg by vehicle and driver, entries, categories and dispatches.",
    source: "RRR",
    filters: ["vehicle", "driver", "area"],
    build: rrrReport,
  },
  {
    key: "special",
    label: "Special collection report",
    description: "Entries, kg, categories, who collected and dispatches.",
    source: "SPECIAL",
    filters: ["area", "collectedBy"],
    build: specialReport,
  },
  {
    key: "vendor",
    label: "Vendor report",
    description:
      "Kg collected via linked BWGs, dispatched by category and purpose, financials, certificates and diversion certificates.",
    superAdminOnly: true,
    filters: ["vendor"],
    build: vendorReport,
  },
  {
    key: "area",
    label: "Area report",
    description: "Every source for an area: collection, dispatch and stock.",
    filters: ["area"],
    build: areaReport,
  },
  {
    key: "stock",
    label: "Stock report",
    description: "Opening, collected, dispatched and closing stock.",
    filters: ["sourceType"],
    build: stockReport,
  },
];

/** The reports this user may generate (section 16). */
export function visibleReports({ isSuperAdmin, canUseSource }) {
  return REPORTS.filter((report) => {
    if (report.superAdminOnly && !isSuperAdmin) return false;
    if (report.source && !canUseSource(report.source)) return false;
    return true;
  });
}

export const PERIOD_PRESETS = [
  { value: "this-month", label: "This month" },
  { value: "last-month", label: "Last month" },
  { value: "this-quarter", label: "This quarter" },
  { value: "this-fy", label: "This financial year" },
  { value: "custom", label: "Custom range" },
];
