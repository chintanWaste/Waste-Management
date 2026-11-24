/**
 * Dispatch (specification section 14).
 *
 * Each tab draws only on its own source type's stock. On submit the quantities
 * are re-checked against available stock, so a stale screen can never push a
 * balance negative (section 5.1).
 */

import {
  DISPATCH, DISPATCH_LINES, isWriteConfigured, WRITE_NOT_CONFIGURED,
} from "../config/driveSchema";
import { appendRow, appendRows, readTab } from "./sheetsApi";
import { availableOn, mmrfAvailableOn } from "../utils/stock";

const PREFIX = { MMRF: "D-MMRF", RRR: "D-RRR", BWG: "D-BWG", SPECIAL: "D-SC" };

function requireWrite() {
  if (!isWriteConfigured()) {
    throw new Error(
      WRITE_NOT_CONFIGURED
    );
  }
}

/** D-BWG-0001, D-MMRF-0002 … never reused. */
function nextDispatchCode(rows, sourceType) {
  const prefix = PREFIX[sourceType];
  let highest = 0;
  const pattern = new RegExp(`^${prefix}-(\\d+)$`);
  for (const row of rows) {
    const match = String(row.Dispatch_Code || "").match(pattern);
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return `${prefix}-${String(highest + 1).padStart(4, "0")}`;
}

function nextLineNumber(rows) {
  let highest = 0;
  for (const row of rows) {
    const match = String(row.Line_Id || "").match(/^DL(\d+)$/);
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return highest + 1;
}

/**
 * Dispatch categorised stock (BWG, RRR on Wheels, Special collection).
 * `lines` is [{ categoryId, name, group, stream, certificate, quantityKg }].
 */
export async function createCategoryDispatch({ sourceType, values, lines, user }) {
  requireWrite();

  const chosen = lines.filter((l) => Number(l.quantityKg) > 0);
  if (!chosen.length) throw new Error("Enter a quantity for at least one category.");

  const [dispatch, dispatchLines, entryCategories] = await Promise.all([
    readTab(DISPATCH.tab).catch(() => []),
    readTab(DISPATCH_LINES.tab).catch(() => []),
    readTab("Entry_Categories").catch(() => []),
  ]);

  // Re-check against live stock at the moment of saving.
  const available = availableOn({
    sourceType,
    dispatchDate: values.Dispatch_Date,
    entryCategories,
    dispatch,
    dispatchLines,
  });

  for (const line of chosen) {
    const have = available[line.categoryId] || 0;
    if (Number(line.quantityKg) > have + 0.005) {
      throw new Error(
        `Only ${have.toFixed(2)} kg of ${line.name} is available on ` +
          `${values.Dispatch_Date}. Reduce the quantity.`
      );
    }
  }

  const code = nextDispatchCode(dispatch, sourceType);
  const totalKg = chosen.reduce((sum, l) => sum + Number(l.quantityKg), 0);
  const now = new Date().toISOString();

  await appendRow(DISPATCH.tab, {
    Dispatch_Code: code,
    Dispatch_Date: values.Dispatch_Date,
    Source_Type: sourceType,
    Source_Ref: sourceType === "BWG" ? "BWG pooled" : "",
    Area: values.Area || "",
    Vendor_Code: values.Vendor_Code,
    Purpose: values.Purpose,
    Financials: values.Financials,
    Total_Quantity_Kg: Number(totalKg.toFixed(2)),
    Status: "Active",
    Created_By: user?.id || "",
    Created_On: now,
    Updated_By: "", Updated_On: "", Approval_Status: "",
  });

  let counter = nextLineNumber(dispatchLines);
  await appendRows(
    DISPATCH_LINES.tab,
    chosen.map((line) => ({
      Line_Id: `DL${counter++}`,
      Dispatch_Code: code,
      Category_Id: line.categoryId,
      Waste_Category: line.name,
      Material_Group: line.group,
      Waste_Stream: line.stream,
      Quantity_Kg: Number(Number(line.quantityKg).toFixed(2)),
      Certificate_Requirement: line.certificate,
      Created_On: now,
    }))
  );

  return { code, totalKg };
}

/**
 * Dispatch MMRF stock — totals only, one dispatch entry per centre.
 * MMRF dispatches are not tracked on the Certificates page (section 14.2).
 */
export async function createMmrfDispatch({ values, rows, user }) {
  requireWrite();

  const chosen = rows.filter((r) => Number(r.quantityKg) > 0);
  if (!chosen.length) throw new Error("Enter a quantity for at least one centre.");

  const [dispatch, inwardMmrf] = await Promise.all([
    readTab(DISPATCH.tab).catch(() => []),
    readTab("Inward_MMRF").catch(() => []),
  ]);

  for (const row of chosen) {
    const have = mmrfAvailableOn({
      mmrfCode: row.code,
      dispatchDate: values.Dispatch_Date,
      inwardMmrf,
      dispatch,
    });
    if (Number(row.quantityKg) > have + 0.005) {
      throw new Error(
        `Only ${have.toFixed(2)} kg is available at ${row.name} on ` +
          `${values.Dispatch_Date}. Reduce the quantity.`
      );
    }
  }

  const now = new Date().toISOString();
  const created = [];
  let pool = dispatch;

  for (const row of chosen) {
    const code = nextDispatchCode(pool, "MMRF");
    await appendRow(DISPATCH.tab, {
      Dispatch_Code: code,
      Dispatch_Date: values.Dispatch_Date,
      Source_Type: "MMRF",
      Source_Ref: row.code,
      Area: values.Area || "",
      Vendor_Code: values.Vendor_Code,
      Purpose: values.Purpose,
      Financials: values.Financials,
      Total_Quantity_Kg: Number(Number(row.quantityKg).toFixed(2)),
      Status: "Active",
      Created_By: user?.id || "",
      Created_On: now,
      Updated_By: "", Updated_On: "", Approval_Status: "",
    });
    pool = [...pool, { Dispatch_Code: code }];
    created.push(code);
  }

  return created;
}
