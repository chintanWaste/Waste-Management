/**
 * The checks section 3.3 requires at the moment an edit is approved.
 *
 * "Approval is re-checked against stock and certificates at the moment of
 * approval; it is refused if it would make stock negative or reduce a dispatch
 * below the quantity certified."
 *
 * The check has to happen on approval, not when the edit was requested: stock
 * and certificates move in between, so an edit that was harmless on Monday can
 * break the books by Wednesday.
 */

import { DISPATCH, INWARD_MMRF, VENDOR_CERTIFICATES } from "../config/driveSchema";
import { readTab } from "./sheetsApi";

const num = (value) => {
  const n = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const live = (row) => String(row.Status || "Active").toLowerCase() !== "deleted";

/**
 * What the record would hold once the pending change were applied.
 * Only the columns in the change are touched.
 */
function applied(record, patch) {
  return { ...record, ...patch };
}

/**
 * Would reducing this MMRF inward entry leave that centre's stock negative?
 *
 * Collected minus dispatched, for the one centre, with the edited figure in
 * place of the stored one.
 */
async function checkMmrfInward({ record, patch }) {
  const next = applied(record, patch);
  const code = next.MMRF_Code;
  if (!code) return "";

  const [inward, dispatch] = await Promise.all([
    readTab(INWARD_MMRF.tab).catch(() => []),
    readTab(DISPATCH.tab).catch(() => []),
  ]);

  let collected = 0;
  for (const row of inward) {
    if (!live(row) || row.MMRF_Code !== code) continue;
    // Use the pending figure for the entry being decided.
    const isThisEntry = String(row.Entry_Id) === String(record.Entry_Id);
    collected += num(isThisEntry ? next.Waste_Collected_Kg : row.Waste_Collected_Kg);
  }

  let dispatched = 0;
  for (const row of dispatch) {
    if (!live(row) || row.Source_Type !== "MMRF" || row.Source_Ref !== code) continue;
    dispatched += num(row.Total_Quantity_Kg);
  }

  const closing = Number((collected - dispatched).toFixed(2));
  if (closing < 0) {
    return (
      `Approving this would leave ${code} with ${closing} kg of stock. ` +
      `${dispatched} kg has already been dispatched from it, so collected waste ` +
      "cannot be reduced below that. Reject the edit, or cancel the dispatches first."
    );
  }
  return "";
}

/**
 * Would reducing this dispatch drop the vendor's total below what they have
 * already certified?
 *
 * A certificate is the vendor's receipt for material they were sent, and is
 * recorded against the vendor and material group rather than one dispatch
 * (section 15.1). So the comparison is the vendor's whole dispatched total,
 * with this edit applied, against everything they have certified — a dispatch
 * cannot afterwards claim less was sent than the vendor has acknowledged.
 */
async function checkDispatch({ record, patch }) {
  const next = applied(record, patch);
  const code = next.Dispatch_Code || record.Dispatch_Code;
  const vendor = next.Vendor_Code || record.Vendor_Code;
  if (!code || !vendor) return "";

  const [dispatch, certificates] = await Promise.all([
    readTab(DISPATCH.tab).catch(() => []),
    readTab(VENDOR_CERTIFICATES.tab).catch(() => []),
  ]);

  let dispatched = 0;
  for (const row of dispatch) {
    if (!live(row) || row.Vendor_Code !== vendor) continue;
    const isThisOne = String(row.Dispatch_Code) === String(code);
    dispatched += num(isThisOne ? next.Total_Quantity_Kg : row.Total_Quantity_Kg);
  }

  let certified = 0;
  for (const row of certificates) {
    if (!live(row) || row.Vendor_Code !== vendor) continue;
    certified += num(row.Quantity_Certified_Kg);
  }

  dispatched = Number(dispatched.toFixed(2));
  certified = Number(certified.toFixed(2));

  if (certified > 0 && dispatched < certified) {
    return (
      `Approving this would leave ${vendor} with ${dispatched} kg dispatched, below ` +
      `the ${certified} kg they have already certified. Reject the edit, or withdraw ` +
      "the certificate first."
    );
  }
  return "";
}

/**
 * Would approving this change break stock or contradict a certificate?
 *
 * Returns a message explaining why it must be refused, or "" if it is safe.
 * A record type with no rule of its own passes: the tabs that can go wrong
 * are the ones holding quantities.
 */
export async function approvalWouldBreak({ recordType, record, patch }) {
  if (!record || !patch) return "";

  if (recordType === INWARD_MMRF.tab) return checkMmrfInward({ record, patch });
  if (recordType === DISPATCH.tab) return checkDispatch({ record, patch });

  /*
   * The categorised sources (RRR, Special, BWG) hold their quantities in
   * Entry_Categories, which section 3.3 requires the Supervisor to update in
   * the same step. Their totals are checked through those category lines
   * rather than the header row, so a header-only edit cannot unbalance stock
   * on its own.
   */
  return "";
}
