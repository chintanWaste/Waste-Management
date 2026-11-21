/**
 * Creating MMRFs, vehicles and drivers (specification sections 9 and 10).
 *
 * Each create follows the same order: check uniqueness, take the next code,
 * upload the PDF, then append the row — so a failed upload never leaves a row
 * pointing at a document that does not exist.
 */

import { DRIVERS, MMRFS, VEHICLES, isWriteConfigured } from "../config/driveSchema";
import { appendRow, readTab, uploadFile } from "./sheetsApi";

/** Codes are never reused (section 4.3). */
export function nextCode(rows, column, prefix) {
  let highest = 0;
  const pattern = new RegExp(`^${prefix}(\\d+)$`);
  for (const row of rows) {
    const match = String(row[column] || "").match(pattern);
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return `${prefix}${highest + 1}`;
}

function requireWrite() {
  if (!isWriteConfigured()) {
    throw new Error(
      "Saving is not connected yet. Deploy the Apps Script Web App and set " +
        "VITE_SHEET_API_URL in app/.env, then try again."
    );
  }
}

const safeName = (s) => String(s).replace(/[\\/:*?"<>|]/g, "-");

/* --------------------------------------------------------------- MMRF (9) */

export async function createMmrf({ values, documents, user }) {
  requireWrite();
  const existing = await readTab(MMRFS.tab).catch(() => []);

  // Name must be unique within an area (section 9).
  const clash = existing.find(
    (r) =>
      String(r.MMRF_Name || "").trim().toLowerCase() ===
        values.MMRF_Name.trim().toLowerCase() &&
      r.Area === values.Area &&
      String(r.Status || "").toLowerCase() !== "deleted"
  );
  if (clash) {
    throw new Error(`${clash.MMRF_Code} already uses this name in ${values.Area}.`);
  }

  const code = nextCode(existing, "MMRF_Code", "MMRF");
  const fileId = await uploadFile(documents, {
    folder: "Documents",
    name: safeName(`${code}_${values.MMRF_Name}_MoU.pdf`),
  });

  await appendRow(MMRFS.tab, {
    MMRF_Code: code,
    MMRF_Name: values.MMRF_Name.trim(),
    Location: values.Location.trim(),
    Area: values.Area,
    Operation_Type: values.Operation_Type,
    Complete_Address: values.Complete_Address.trim(),
    In_Charge_Name: values.In_Charge_Name.trim(),
    Contact_Number: values.Contact_Number,
    Email: values.Email.trim(),
    Capacity_Kg_Per_Day: values.Capacity_Kg_Per_Day,
    Number_Of_Workers: values.Number_Of_Workers,
    Supervised_By: values.Supervised_By.trim(),
    MoU_File_Id: fileId,
    Status: "Active",
    Created_By: user?.id || "",
    Created_On: new Date().toISOString(),
    Updated_By: "", Updated_On: "",
  });

  return code;
}

/* ------------------------------------------------------------ vehicles (10) */

export async function createVehicle({ values, documents, user }) {
  requireWrite();
  const existing = await readTab(VEHICLES.tab).catch(() => []);

  const unique = [
    ["Registration_Number", "registration number"],
    ["Engine_Number", "engine number"],
    ["Chassis_Number", "chassis number"],
  ];
  for (const [column, label] of unique) {
    const value = String(values[column]).replace(/\s/g, "").toUpperCase();
    const clash = existing.find(
      (r) => String(r[column] || "").replace(/\s/g, "").toUpperCase() === value
    );
    if (clash) throw new Error(`${clash.Vehicle_Code} already has this ${label}.`);
  }

  const code = nextCode(existing, "Vehicle_Code", "VH");
  const registration = values.Registration_Number.replace(/[\s-]/g, "").toUpperCase();

  const fileId = await uploadFile(documents, {
    folder: "Documents",
    name: safeName(`${code}_${registration}_documents.pdf`),
  });

  await appendRow(VEHICLES.tab, {
    Vehicle_Code: code,
    Registration_Number: registration,
    Engine_Number: values.Engine_Number.trim().toUpperCase(),
    Chassis_Number: values.Chassis_Number.trim().toUpperCase(),
    Vehicle_Type: values.Vehicle_Type,
    Vehicle_Model: values.Vehicle_Model.trim(),
    Insurance_Validity_Date: values.Insurance_Validity_Date,
    // PUC is not applicable to an electric vehicle (section 10.1).
    PUC_Validity_Date: values.Vehicle_Type === "Electric" ? "" : values.PUC_Validity_Date,
    Fitness_Validity_Date: values.Fitness_Validity_Date,
    Registration_Validity_Date: values.Registration_Validity_Date,
    Documents_File_Id: fileId,
    Status: "Active",
    Created_By: user?.id || "",
    Created_On: new Date().toISOString(),
    Updated_By: "", Updated_On: "",
  });

  return code;
}

/* ------------------------------------------------------------- drivers (10) */

export async function createDriver({ values, documents, user }) {
  requireWrite();
  const existing = await readTab(DRIVERS.tab).catch(() => []);

  const licence = values.Licence_Number.trim().toUpperCase();
  const clash = existing.find(
    (r) => String(r.Licence_Number || "").trim().toUpperCase() === licence
  );
  if (clash) throw new Error(`${clash.Driver_Code} already has this driving licence number.`);

  const code = nextCode(existing, "Driver_Code", "DR");
  const fileId = await uploadFile(documents, {
    folder: "Documents",
    name: safeName(`${code}_${values.Driver_Name}_licence.pdf`),
  });

  await appendRow(DRIVERS.tab, {
    Driver_Code: code,
    Driver_Name: values.Driver_Name.trim(),
    Licence_Number: licence,
    Contact_Number: values.Contact_Number,
    Licence_Validity_Date: values.Licence_Validity_Date,
    Licence_File_Id: fileId,
    Status: "Active",
    Created_By: user?.id || "",
    Created_On: new Date().toISOString(),
    Updated_By: "", Updated_On: "",
  });

  return code;
}
