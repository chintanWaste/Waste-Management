/**
 * Vendor certificates and diversion certificates (specification section 15).
 */

import {
  DIVERSION_CERTIFICATES, VENDOR_CERTIFICATES, isWriteConfigured, WRITE_NOT_CONFIGURED,
} from "../config/driveSchema";
import { appendRow, readTab, updateRow, uploadFile } from "./sheetsApi";
import {
  certificateUsage, certificateRows, eligibleCertificates, nextDiversionNumber,
} from "../utils/certificates";
import { buildDiversionPdf } from "../utils/diversionPdf";

function requireWrite() {
  if (!isWriteConfigured()) {
    throw new Error(
      WRITE_NOT_CONFIGURED
    );
  }
}

function nextId(rows, column, prefix) {
  let highest = 0;
  const pattern = new RegExp(`^${prefix}(\\d+)$`);
  for (const row of rows) {
    const match = String(row[column] || "").match(pattern);
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return `${prefix}${highest + 1}`;
}

/* --------------------------------------- 15.1  certificates from a vendor */

export async function addVendorCertificate({
  vendorCode, values, file, certificateGroups, user,
}) {
  requireWrite();

  const [certificates, dispatch, dispatchLines] = await Promise.all([
    readTab(VENDOR_CERTIFICATES.tab).catch(() => []),
    readTab("Dispatch").catch(() => []),
    readTab("Dispatch_Lines").catch(() => []),
  ]);

  // Certificate number is unique per vendor (section 15.1).
  const clash = certificates.find(
    (c) =>
      c.Vendor_Code === vendorCode &&
      String(c.Certificate_Number || "").trim().toLowerCase() ===
        values.Certificate_Number.trim().toLowerCase() &&
      String(c.Status || "").toLowerCase() !== "deleted"
  );
  if (clash) {
    throw new Error(`${vendorCode} already has a certificate numbered ${values.Certificate_Number}.`);
  }

  // Quantity cannot exceed the pending kg of that material group.
  const rows = certificateRows({
    vendorCode, dispatch, dispatchLines, certificates, certificateGroups,
  });
  const row = rows.find((r) => r.group === values.Material_Group);
  const pending = row?.pending ?? 0;

  if (Number(values.Quantity_Certified_Kg) > pending + 0.005) {
    throw new Error(
      `Only ${pending.toFixed(2)} kg of ${values.Material_Group} is pending certification ` +
        `for ${vendorCode}.`
    );
  }

  const id = nextId(certificates, "Certificate_Id", "VC");
  const fileId = await uploadFile(file, {
    folder: "Documents",
    name: `${vendorCode}_${values.Certificate_Number}.pdf`.replace(/[\\/:*?"<>|]/g, "-"),
  });

  await appendRow(VENDOR_CERTIFICATES.tab, {
    Certificate_Id: id,
    Vendor_Code: vendorCode,
    Certificate_Number: values.Certificate_Number.trim(),
    Certificate_Date: values.Certificate_Date,
    Material_Group: values.Material_Group,
    Quantity_Certified_Kg: Number(Number(values.Quantity_Certified_Kg).toFixed(2)),
    Quantity_Used_Kg: 0,
    Quantity_Remaining_Kg: Number(Number(values.Quantity_Certified_Kg).toFixed(2)),
    Certificate_File_Id: fileId,
    Status: "Active",
    Created_By: user?.id || "",
    Created_On: new Date().toISOString(),
    Updated_By: "", Updated_On: "",
  });

  return id;
}

/**
 * A certificate used by a diversion certificate cannot be deleted, and its
 * quantity cannot be reduced below the quantity already used (section 15.1).
 */
export async function deleteVendorCertificate({ certificateId, user }) {
  requireWrite();

  const diversions = await readTab(DIVERSION_CERTIFICATES.tab).catch(() => []);
  const used = certificateUsage(certificateId, diversions);

  if (used > 0) {
    throw new Error(
      `This certificate has ${used.toFixed(2)} kg issued as diversion certificates ` +
        "and cannot be deleted. Cancel those certificates first."
    );
  }

  await updateRow(VENDOR_CERTIFICATES.tab, VENDOR_CERTIFICATES.idColumn, certificateId, {
    Status: "Deleted",
    Updated_By: user?.id || "",
    Updated_On: new Date().toISOString(),
  });
}

/* ------------------------------------ 15.2  diversion certificates to BWGs */

export async function issueDiversionCertificate({
  values, bwg, vendorName, signatory, logoUrl, prefix, user,
}) {
  requireWrite();

  const [certificates, diversions, dispatch] = await Promise.all([
    readTab(VENDOR_CERTIFICATES.tab).catch(() => []),
    readTab(DIVERSION_CERTIFICATES.tab).catch(() => []),
    readTab("Dispatch").catch(() => []),
  ]);

  // Re-check the remaining quantity at the moment of issuing.
  const eligible = eligibleCertificates({
    materialGroup: values.Material_Group,
    certificates, diversionCertificates: diversions, dispatch,
  });
  const source = eligible.find((c) => c.Certificate_Id === values.Vendor_Certificate_Id);

  if (!source) {
    throw new Error(
      "No quantity left on this certificate – choose another certificate number."
    );
  }
  if (Number(values.Quantity_Kg) > source.remaining + 0.005) {
    throw new Error(
      `Only ${source.remaining.toFixed(2)} kg is left on certificate ` +
        `${source.Certificate_Number}.`
    );
  }

  const number = nextDiversionNumber({
    certificateDate: values.Certificate_Date,
    existing: diversions,
    prefix,
  });

  const certificate = {
    Diversion_Certificate_No: number,
    Certificate_Date: values.Certificate_Date,
    BWG_Code: values.BWG_Code,
    Material_Group: values.Material_Group,
    Vendor_Certificate_Id: source.Certificate_Id,
    Vendor_Certificate_Number: source.Certificate_Number,
    Vendor_Code: source.Vendor_Code,
    Quantity_Kg: Number(Number(values.Quantity_Kg).toFixed(2)),
    Processing_Method: values.Processing_Method,
    Period_From: values.Period_From,
    Period_To: values.Period_To,
    Status: "Active",
  };

  // Build the PDF first — nothing is recorded if it cannot be produced.
  const doc = await buildDiversionPdf({ certificate, bwg, vendorName, signatory, logoUrl });
  const blob = doc.output("blob");
  const fileName = `${number.replace(/\//g, "_")}.pdf`;
  const pdfFile = new File([blob], fileName, { type: "application/pdf" });

  const fileId = await uploadFile(pdfFile, { folder: "Documents", name: fileName });

  await appendRow(DIVERSION_CERTIFICATES.tab, {
    ...certificate,
    PDF_File_Id: fileId,
    Cancelled_Reason: "", Cancelled_By: "", Cancelled_On: "",
    Created_By: user?.id || "",
    Created_On: new Date().toISOString(),
  });

  // Keep the convenience columns on the vendor certificate in step.
  const used = certificateUsage(source.Certificate_Id, diversions) + certificate.Quantity_Kg;
  await updateRow(VENDOR_CERTIFICATES.tab, VENDOR_CERTIFICATES.idColumn, source.Certificate_Id, {
    Quantity_Used_Kg: Number(used.toFixed(2)),
    Quantity_Remaining_Kg: Number((source.total - used).toFixed(2)),
  });

  return { number, doc, fileName };
}

/**
 * Section 15.3 — an issued certificate cannot be edited. Cancelling returns the
 * quantity to the vendor certificate and marks the PDF "Cancelled".
 */
export async function cancelDiversionCertificate({
  number, reason, bwg, vendorName, signatory, logoUrl, user,
}) {
  requireWrite();
  if (!reason?.trim()) throw new Error("Give a reason for cancelling the certificate.");

  const [diversions, certificates] = await Promise.all([
    readTab(DIVERSION_CERTIFICATES.tab).catch(() => []),
    readTab(VENDOR_CERTIFICATES.tab).catch(() => []),
  ]);

  const row = diversions.find((d) => d.Diversion_Certificate_No === number);
  if (!row) throw new Error("That certificate no longer exists.");
  if (String(row.Status || "").toLowerCase() === "cancelled") {
    throw new Error("That certificate is already cancelled.");
  }

  // Re-stamp the PDF with the cancelled overlay.
  const cancelled = { ...row, Status: "Cancelled" };
  const doc = await buildDiversionPdf({ certificate: cancelled, bwg, vendorName, signatory, logoUrl });
  const fileName = `${number.replace(/\//g, "_")}_cancelled.pdf`;
  const pdfFile = new File([doc.output("blob")], fileName, { type: "application/pdf" });
  const fileId = await uploadFile(pdfFile, { folder: "Documents", name: fileName });

  const now = new Date().toISOString();
  await updateRow(DIVERSION_CERTIFICATES.tab, DIVERSION_CERTIFICATES.idColumn, number, {
    Status: "Cancelled",
    Cancelled_Reason: reason.trim(),
    Cancelled_By: user?.id || "",
    Cancelled_On: now,
    PDF_File_Id: fileId,
  });

  // The quantity goes back to the vendor certificate.
  const source = certificates.find((c) => c.Certificate_Id === row.Vendor_Certificate_Id);
  if (source) {
    const used = Math.max(
      0,
      certificateUsage(source.Certificate_Id, diversions) - Number(row.Quantity_Kg || 0)
    );
    await updateRow(VENDOR_CERTIFICATES.tab, VENDOR_CERTIFICATES.idColumn, source.Certificate_Id, {
      Quantity_Used_Kg: Number(used.toFixed(2)),
      Quantity_Remaining_Kg: Number(
        (Number(source.Quantity_Certified_Kg || 0) - used).toFixed(2)
      ),
    });
  }
}
