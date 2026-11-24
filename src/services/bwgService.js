/**
 * Creating a BWG and reading the directory (specification section 8).
 *
 * The directory shows each BWG's current vendor, which lives in the
 * BWG_Vendor_Linkage tab rather than on the BWG row, so that re-linking never
 * rewrites history (section 11).
 */

import {
  BWGS, LINKAGE, VENDORS, isWriteConfigured, WRITE_NOT_CONFIGURED,
} from "../config/driveSchema";
import { viewUrl } from "./drive";
import { appendRow, deleteRow, readTab, updateRow, uploadFile } from "./sheetsApi";

function requireWrite() {
  if (!isWriteConfigured()) {
    throw new Error(
      WRITE_NOT_CONFIGURED
    );
  }
}

/**
 * Put the documents PDF in Drive and return the link to store.
 *
 * The full Drive URL is stored rather than a bare id, so the cell is useful
 * on its own — clickable in the sheet and in an export.
 */
async function uploadDocuments(documents, code, name) {
  const fileId = await uploadFile(documents, {
    folder: "Documents",
    name: `${code}_${name}_documents.pdf`.replace(/[\\/:*?"<>|]/g, "-"),
  });
  return viewUrl(fileId);
}

/** The sheet columns that come straight from the form, shared by create and edit. */
function fieldsFromForm(values) {
  const panAvailable = values.PAN_Not_Available !== "Yes";

  return {
    BWG_Name: values.BWG_Name.trim(),
    BWG_Type: values.BWG_Type,
    BWG_Type_Other: values.BWG_Type === "Others" ? values.BWG_Type_Other.trim() : "",
    Area: values.Area,
    Operation_Type: values.Operation_Type,
    Onboarding_Date: values.Onboarding_Date,
    Address: values.Address.trim(),
    Pin_Code: values.Pin_Code,
    Ward_Zone: values.Ward_Zone.trim(),
    Contact_Person: values.Contact_Person.trim(),
    Phone: values.Phone,
    Email: values.Email.trim(),
    Collection_Frequency: values.Collection_Frequency,
    GST_Registered: values.GST_Registered,
    GST_Number: values.GST_Registered === "Yes" ? values.GST_Number.toUpperCase() : "",
    PAN_Number: panAvailable ? values.PAN_Number.toUpperCase() : "",
    PAN_Not_Available: values.PAN_Not_Available,
    Agreement_Type: values.Agreement_Type,
    Bank_Account_Name: values.Bank_Account_Name.trim(),
    Bank_Name: values.Bank_Name.trim(),
    Account_Number: values.Account_Number,
    IFSC_Code: values.IFSC_Code.toUpperCase(),
    Branch_Name: values.Branch_Name.trim(),
    Bank_Address: values.Bank_Address.trim(),
  };
}

/** Codes are never reused: if BWG3 was deleted, the next is still BWG4. */
export function nextBwgCode(rows = []) {
  let highest = 0;
  for (const row of rows) {
    const match = String(row.BWG_Code || "").match(/^BWG(\d+)$/);
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return `BWG${highest + 1}`;
}

/** { BWG_Code: "V1 — Green Cycle" } for the directory's "Linked vendor" column. */
export function currentVendorByBwg(linkageRows = [], vendorRows = []) {
  const vendorName = Object.fromEntries(
    vendorRows.map((v) => [v.Vendor_Code, v.Vendor_Name])
  );

  const out = {};
  for (const row of linkageRows) {
    const current =
      String(row.Is_Current || "").toLowerCase() === "yes" ||
      !String(row.Linked_To_Date || "").trim();
    if (!current || !row.BWG_Code || !row.Vendor_Code) continue;

    out[row.BWG_Code] = vendorName[row.Vendor_Code]
      ? `${row.Vendor_Code} — ${vendorName[row.Vendor_Code]}`
      : row.Vendor_Code;
  }
  return out;
}

/** Everything the BWG page needs, in one go. */
export async function loadBwgDirectory() {
  const [bwgs, linkage, vendors] = await Promise.all([
    readTab(BWGS.tab).catch(() => []),
    readTab(LINKAGE.tab).catch(() => []),
    readTab(VENDORS.tab).catch(() => []),
  ]);

  const vendorByBwg = currentVendorByBwg(linkage, vendors);

  return {
    bwgs: bwgs.map((row) => ({ ...row, Linked_Vendor: vendorByBwg[row.BWG_Code] || "" })),
    raw: bwgs,
  };
}

/**
 * Creates the BWG and returns { code, row }.
 *
 * `row` is exactly what was written, so the directory can show the BWG
 * before the Sheet CSV endpoint catches up with the append.
 */
export async function createBwg({ values, documents, user }) {
  requireWrite();

  const existing = await readTab(BWGS.tab).catch(() => []);
  const code = nextBwgCode(existing);
  const link = await uploadDocuments(documents, code, values.BWG_Name);

  const row = {
    BWG_Code: code,
    ...fieldsFromForm(values),
    Documents_File_Id: link,
    Status: "Active",
    Created_By: user?.id || "",
    Created_On: new Date().toISOString(),
    Updated_By: "",
    Updated_On: "",
  };

  await appendRow(BWGS.tab, row);

  return { code, row };
}

/**
 * Updates an existing BWG and returns { code, row }.
 *
 * `documents` is only the replacement PDF: leaving it empty keeps whatever
 * is already on record.
 */
export async function updateBwg({ code, values, documents, existing, user }) {
  requireWrite();

  const patch = {
    ...fieldsFromForm(values),
    Updated_By: user?.id || "",
    Updated_On: new Date().toISOString(),
  };

  if (documents) {
    patch.Documents_File_Id = await uploadDocuments(documents, code, values.BWG_Name);
  }

  await updateRow(BWGS.tab, BWGS.idColumn, code, patch);

  return { code, row: { ...existing, BWG_Code: code, ...patch } };
}

/**
 * Removes the BWG from the sheet, after the Apps Script archives a full copy
 * to Deleted_Items.
 */
export async function deleteBwg({ code, label, user }) {
  requireWrite();

  const result = await deleteRow(BWGS.tab, BWGS.idColumn, code, {
    label: label || code,
    user: user?.id || "",
  });

  if (!result?.removed) {
    throw new Error(
      `${code} was not removed from the sheet. The Apps Script Web App is ` +
        "running an older version that only marks a record Deleted. Paste in the " +
        "current apps-script/Code.gs and deploy a new version."
    );
  }

  return { code };
}

