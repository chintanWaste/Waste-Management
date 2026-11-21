/**
 * Creating a vendor (specification section 7).
 *
 * Order matters: the PDF goes to Drive first, so a failed upload never leaves a
 * vendor row pointing at a document that does not exist.
 */

import { VENDORS, isDriveConfigured, isWriteConfigured } from "../config/driveSchema";
import { appendRow, readTab, uploadFile } from "./sheetsApi";

/** Codes are never reused: if V3 was deleted, the next vendor is still V4. */
export function nextVendorCode(rows = []) {
  let highest = 0;
  for (const row of rows) {
    const match = String(row.Vendor_Code || "").match(/^V(\d+)$/);
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return `V${highest + 1}`;
}

/** PANs and GSTINs already in use, so the form can refuse a duplicate. */
export async function loadVendorIdentifiers() {
  if (!isDriveConfigured()) return { pans: [], gstins: [], rows: [] };

  const rows = await readTab(VENDORS.tab).catch(() => []);
  const live = rows.filter((r) => String(r.Status || "").toLowerCase() !== "deleted");

  return {
    rows,
    pans: live.map((r) => String(r.PAN_Number || "").toUpperCase()).filter(Boolean),
    gstins: live.map((r) => String(r.GST_Number || "").toUpperCase()).filter(Boolean),
  };
}

/**
 * Creates the vendor and returns { code, row }.
 *
 * `values` comes straight from the form; `documents` is the chosen File.
 * `row` is exactly what was written, so the directory can show the vendor
 * before the Sheet CSV endpoint catches up with the append.
 */
export async function createVendor({ values, documents, user }) {
  if (!isWriteConfigured()) {
    throw new Error(
      "Saving is not connected yet. Deploy the Apps Script Web App and set " +
        "VITE_SHEET_API_URL in app/.env, then try again."
    );
  }

  const { rows } = await loadVendorIdentifiers();
  const code = nextVendorCode(rows);

  const fileId = await uploadFile(documents, {
    folder: "Documents",
    name: `${code}_${values.Vendor_Name}_documents.pdf`.replace(/[\\/:*?"<>|]/g, "-"),
  });

  const now = new Date().toISOString();
  const gstRegistered = values.GST_Registered === "Yes";

  const row = {
    Vendor_Code: code,
    Vendor_Name: values.Vendor_Name.trim(),
    Vendor_Type: values.Vendor_Type,
    Vendor_Type_Other: values.Vendor_Type === "Others" ? values.Vendor_Type_Other.trim() : "",
    Address: values.Address.trim(),
    City_District: values.City_District.trim(),
    State: values.State,
    Pin_Code: values.Pin_Code,
    Contact_Person: values.Contact_Person.trim(),
    Phone: values.Phone,
    Email: values.Email.trim(),
    PAN_Number: values.PAN_Number.toUpperCase(),
    GST_Registered: values.GST_Registered,
    GST_Number: gstRegistered ? values.GST_Number.toUpperCase() : "",
    Onboarding_Date: values.Onboarding_Date,
    MoU_Type: values.MoU_Type,
    MoU_End_Date: values.MoU_Type === "Fixed-term" ? values.MoU_End_Date : "",
    Bank_Account_Name: values.Bank_Account_Name.trim(),
    Bank_Name: values.Bank_Name.trim(),
    Account_Number: values.Account_Number,
    Branch_Name: values.Branch_Name.trim(),
    IFSC_Code: values.IFSC_Code.toUpperCase(),
    Documents_File_Id: fileId,
    Status: "Active",
    Created_By: user?.id || "",
    Created_On: now,
    Updated_By: "",
    Updated_On: "",
  };

  await appendRow(VENDORS.tab, row);

  return { code, row };
}
