/**
 * BWG–Vendor linkage (specification section 11).
 *
 * Allocations are kept by time period: assigning a new vendor closes the
 * current row with a Linked_To_Date and opens a new one. Every BWG daily inward
 * record stores the vendor linked on that date, so changing the vendor never
 * changes past data or past vendor totals.
 */

import { LINKAGE, isWriteConfigured } from "../config/driveSchema";
import { appendRow, readTab, updateRow } from "./sheetsApi";
import { parseDate } from "../utils/format";

const isCurrent = (row) =>
  String(row.Is_Current || "").toLowerCase() === "yes" ||
  !String(row.Linked_To_Date || "").trim();

/** The allocation rows for one BWG, newest first. */
export const historyFor = (rows, bwgCode) =>
  rows
    .filter((r) => r.BWG_Code === bwgCode)
    .sort((a, b) =>
      String(b.Linked_From_Date || "").localeCompare(String(a.Linked_From_Date || ""))
    );

/** { BWG_Code: linkage row } for the vendor linked right now. */
export function currentLinks(rows = []) {
  const out = {};
  for (const row of rows) {
    if (!row.BWG_Code || !row.Vendor_Code || !isCurrent(row)) continue;
    const existing = out[row.BWG_Code];
    if (
      !existing ||
      String(row.Linked_From_Date || "") > String(existing.Linked_From_Date || "")
    ) {
      out[row.BWG_Code] = row;
    }
  }
  return out;
}

/**
 * The vendor linked to a BWG on a given date — what BWG daily inward stores.
 * Returns "" when the BWG had no vendor that day.
 */
export function vendorOnDate(rows, bwgCode, onDate) {
  const when = parseDate(onDate);
  if (!when) return "";

  const candidates = rows
    .filter((r) => r.BWG_Code === bwgCode && r.Vendor_Code)
    .filter((r) => {
      const from = parseDate(r.Linked_From_Date);
      if (!from || from > when) return false;
      const to = parseDate(r.Linked_To_Date);
      return !to || to >= when;
    })
    .sort((a, b) =>
      String(b.Linked_From_Date || "").localeCompare(String(a.Linked_From_Date || ""))
    );

  return candidates[0]?.Vendor_Code || "";
}

function nextLinkageId(rows) {
  let highest = 0;
  for (const row of rows) {
    const match = String(row.Linkage_Id || "").match(/^L(\d+)$/);
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return highest + 1;
}

/**
 * Assign one vendor to one or more BWGs from a date (section 11, bulk action).
 * One vendor per BWG at any time, so any open allocation is closed first.
 */
export async function assignVendor({ bwgCodes, vendorCode, fromDate, user }) {
  if (!isWriteConfigured()) {
    throw new Error(
      "Saving is not connected yet. Deploy the Apps Script Web App and set " +
        "VITE_SHEET_API_URL in app/.env, then try again."
    );
  }
  if (!vendorCode) throw new Error("Choose a vendor.");
  if (!fromDate) throw new Error("Choose the date the linkage starts.");
  if (!bwgCodes.length) throw new Error("Choose at least one BWG.");

  const rows = await readTab(LINKAGE.tab).catch(() => []);
  const current = currentLinks(rows);

  // The previous allocation ends the day before the new one begins.
  const dayBefore = new Date(parseDate(fromDate));
  dayBefore.setDate(dayBefore.getDate() - 1);
  const closedOn = dayBefore.toISOString().slice(0, 10);

  let counter = nextLinkageId(rows);
  const now = new Date().toISOString();
  let changed = 0;
  let skipped = 0;

  for (const bwgCode of bwgCodes) {
    const open = current[bwgCode];

    if (open && open.Vendor_Code === vendorCode) { skipped += 1; continue; }

    if (open) {
      if (parseDate(open.Linked_From_Date) > parseDate(fromDate)) {
        throw new Error(
          `${bwgCode} is already linked to ${open.Vendor_Code} from ` +
            `${open.Linked_From_Date}. Choose a later start date.`
        );
      }
      await updateRow(LINKAGE.tab, LINKAGE.idColumn, open.Linkage_Id, {
        Linked_To_Date: closedOn,
        Is_Current: "No",
      });
    }

    await appendRow(LINKAGE.tab, {
      Linkage_Id: `L${counter++}`,
      BWG_Code: bwgCode,
      Vendor_Code: vendorCode,
      Linked_From_Date: fromDate,
      Linked_To_Date: "",
      Is_Current: "Yes",
      Created_By: user?.id || "",
      Created_On: now,
    });
    changed += 1;
  }

  return { changed, skipped };
}
