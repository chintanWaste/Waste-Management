/**
 * Creating, editing and removing a vendor (specification section 7).
 *
 * Order matters on write: the PDF goes to Drive first, so a failed upload never
 * leaves a vendor row pointing at a document that does not exist.
 */

import {
  VENDORS, isDriveConfigured, isWriteConfigured, WRITE_NOT_CONFIGURED,
} from "../config/driveSchema";
import { viewUrl } from "./drive";
import { appendRow, deleteRow, readTab, updateRow, uploadFile } from "./sheetsApi";

function requireWrite() {
  if (!isWriteConfigured()) throw new Error(WRITE_NOT_CONFIGURED);
}

/** Codes are never reused: if V3 was deleted, the next vendor is still V4. */
export function nextVendorCode(rows = []) {
  let highest = 0;
  for (const row of rows) {
    const match = String(row.Vendor_Code || "").match(/^V(\d+)$/);
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return `V${highest + 1}`;
}

/**
 * PANs and GSTINs already in use, so the form can refuse a duplicate.
 *
 * `exceptCode` leaves one vendor out, so editing a vendor does not see its own
 * PAN and GST number as somebody else's and refuse to save.
 */
export async function loadVendorIdentifiers({ exceptCode = "" } = {}) {
  if (!isDriveConfigured()) return { pans: [], gstins: [], rows: [] };

  const rows = await readTab(VENDORS.tab).catch(() => []);
  const live = rows.filter(
    (r) =>
      String(r.Status || "").toLowerCase() !== "deleted" &&
      String(r.Vendor_Code || "") !== String(exceptCode)
  );

  return {
    rows,
    pans: live.map((r) => String(r.PAN_Number || "").toUpperCase()).filter(Boolean),
    gstins: live.map((r) => String(r.GST_Number || "").toUpperCase()).filter(Boolean),
  };
}

/** The sheet columns that come straight from the form, shared by create and edit. */
function fieldsFromForm(values) {
  const gstRegistered = values.GST_Registered === "Yes";

  return {
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
  };
}

/**
 * Put the documents PDF in Drive and return the link to store.
 *
 * The full "open in Drive" URL is stored rather than the bare file id, so the
 * cell is useful on its own — clickable in the Sheet and in an export. Every
 * reader goes through toFileId() in services/drive.js, which pulls the id back
 * out of the URL, so rows written before this change still work.
 */
async function uploadDocuments(documents, code, vendorName) {
  const fileId = await uploadFile(documents, {
    folder: "Documents",
    name: `${code}_${vendorName}_documents.pdf`.replace(/[\\/:*?"<>|]/g, "-"),
  });
  return viewUrl(fileId);
}

/**
 * Creates the vendor and returns { code, row }.
 *
 * `values` comes straight from the form; `documents` is the chosen File.
 * `row` is exactly what was written, so the directory can show the vendor
 * before the Sheet CSV endpoint catches up with the append.
 */
export async function createVendor({ values, documents, user }) {
  requireWrite();

  const { rows } = await loadVendorIdentifiers();
  const code = nextVendorCode(rows);
  const link = await uploadDocuments(documents, code, values.Vendor_Name);

  const row = {
    Vendor_Code: code,
    ...fieldsFromForm(values),
    Documents_File_Id: link,
    Status: "Active",
    Created_By: user?.id || "",
    Created_On: new Date().toISOString(),
    Updated_By: "",
    Updated_On: "",
  };

  await appendRow(VENDORS.tab, row);

  return { code, row };
}

/**
 * Updates an existing vendor and returns { code, row }.
 *
 * `documents` is only the *replacement* PDF. Leaving it empty keeps whatever
 * the vendor already had, so an edit of a phone number does not demand the
 * paperwork be attached again.
 */
export async function updateVendor({ code, values, documents, existing, user }) {
  requireWrite();

  const patch = {
    ...fieldsFromForm(values),
    Updated_By: user?.id || "",
    Updated_On: new Date().toISOString(),
  };

  if (documents) {
    patch.Documents_File_Id = await uploadDocuments(documents, code, values.Vendor_Name);
  }

  await updateRow(VENDORS.tab, VENDORS.idColumn, code, patch);

  return { code, row: { ...existing, Vendor_Code: code, ...patch } };
}

/**
 * Soft-deletes a vendor: Status becomes Deleted and a copy is archived to
 * Deleted_Items, so the record can be restored and nothing is ever lost.
 */
export async function deleteVendor({ code, label, user }) {
  requireWrite();

  const result = await deleteRow(VENDORS.tab, VENDORS.idColumn, code, {
    label: label || code,
    user: user?.id || "",
  });

  /*
   * Only the current Apps Script removes the row and reports `removed`. An
   * older deployment answers ok after merely setting Status to Deleted, so
   * without this check the record looks deleted until the next refresh puts
   * it back. Say what actually happened instead.
   */
  if (!result?.removed) {
    throw new Error(
      `${code} was not removed from the sheet. The Apps Script Web App is ` +
        "running an older version that only marks a record Deleted. In the " +
        "Apps Script editor, paste in the current apps-script/Code.gs, then run " +
        "Deploy > Manage deployments > edit (pencil) > Version: New version. " +
        "Opening the /exec URL should then report a version."
    );
  }

  return { code };
}
