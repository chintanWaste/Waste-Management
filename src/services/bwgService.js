/**
 * Creating a BWG and reading the directory (specification section 8).
 *
 * The directory shows each BWG's current vendor, which lives in the
 * BWG_Vendor_Linkage tab rather than on the BWG row, so that re-linking never
 * rewrites history (section 11).
 */

import { BWGS, LINKAGE, VENDORS, isWriteConfigured } from "../config/driveSchema";
import { appendRow, readTab, uploadFile } from "./sheetsApi";

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

export async function createBwg({ values, documents, user }) {
  if (!isWriteConfigured()) {
    throw new Error(
      "Saving is not connected yet. Deploy the Apps Script Web App and set " +
        "VITE_SHEET_API_URL in app/.env, then try again."
    );
  }

  const existing = await readTab(BWGS.tab).catch(() => []);
  const code = nextBwgCode(existing);

  const fileId = await uploadFile(documents, {
    folder: "Documents",
    name: `${code}_${values.BWG_Name}_documents.pdf`.replace(/[\\/:*?"<>|]/g, "-"),
  });

  const now = new Date().toISOString();
  const panAvailable = values.PAN_Not_Available !== "Yes";

  await appendRow(BWGS.tab, {
    BWG_Code: code,
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
    Documents_File_Id: fileId,
    Status: "Active",
    Created_By: user?.id || "",
    Created_On: now,
    Updated_By: "",
    Updated_On: "",
  });

  return code;
}
