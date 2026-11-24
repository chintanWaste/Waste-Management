/**
 * Creating MMRFs, vehicles and drivers (specification sections 9 and 10).
 *
 * Each create follows the same order: check uniqueness, take the next code,
 * upload the PDF, then append the row — so a failed upload never leaves a row
 * pointing at a document that does not exist.
 */

import {
  DRIVERS, MMRFS, VEHICLES, isWriteConfigured, WRITE_NOT_CONFIGURED,
} from "../config/driveSchema";
import { viewUrl } from "./drive";
import { appendRow, deleteRow, readTab, updateRow, uploadFile } from "./sheetsApi";

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
      WRITE_NOT_CONFIGURED
    );
  }
}

const safeName = (s) => String(s).replace(/[\\/:*?"<>|]/g, "-");

/* ------------------------------------------------- shared edit and delete */

/**
 * Soft-delete any record: Status becomes Deleted and a copy is archived to
 * Deleted_Items by the Apps Script, so nothing is ever actually lost.
 *
 * `tab` is a TABS entry from config/driveSchema.js, which carries its own
 * idColumn, so no caller has to remember which column identifies a record.
 */
export async function deleteRecord({ tab, id, label, user }) {
  requireWrite();

  await deleteRow(tab.tab, tab.idColumn, id, {
    label: label || id,
    user: user?.id || "",
  });

  return { id };
}

/**
 * Patch any record, stamping who changed it and when.
 *
 * `patch` holds only the columns that change; everything else on the row is
 * left exactly as it was.
 */
export async function updateRecord({ tab, id, patch, user }) {
  requireWrite();

  const fields = {
    ...patch,
    Updated_By: user?.id || "",
    Updated_On: new Date().toISOString(),
  };

  await updateRow(tab.tab, tab.idColumn, id, fields);

  return { id, patch: fields };
}

/** Upload a replacement document and return the link to store. */
export async function uploadDocument({ file, folder = "Documents", name }) {
  const fileId = await uploadFile(file, { folder, name: safeName(name) });
  return viewUrl(fileId);
}

/* --------------------------------------------------------------- MMRF (9) */

/** The MMRF columns that come from the form, shared by create and edit. */
function mmrfFields(values) {
  return {
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
  };
}

/** Refuses a name already used in the same area, ignoring one code when editing. */
function assertMmrfNameFree(existing, values, exceptCode) {
  const clash = existing.find(
    (r) =>
      String(r.MMRF_Name || "").trim().toLowerCase() ===
        values.MMRF_Name.trim().toLowerCase() &&
      r.Area === values.Area &&
      String(r.MMRF_Code || "") !== String(exceptCode || "") &&
      String(r.Status || "").toLowerCase() !== "deleted"
  );
  if (clash) {
    throw new Error(`${clash.MMRF_Code} already uses this name in ${values.Area}.`);
  }
}

export async function createMmrf({ values, documents, user }) {
  requireWrite();
  const existing = await readTab(MMRFS.tab).catch(() => []);

  // Name must be unique within an area (section 9).
  assertMmrfNameFree(existing, values);

  const code = nextCode(existing, "MMRF_Code", "MMRF");
  const link = await uploadDocument({
    file: documents,
    name: `${code}_${values.MMRF_Name}_MoU.pdf`,
  });

  const row = {
    MMRF_Code: code,
    ...mmrfFields(values),
    MoU_File_Id: link,
    Status: "Active",
    Created_By: user?.id || "",
    Created_On: new Date().toISOString(),
    Updated_By: "", Updated_On: "",
  };

  await appendRow(MMRFS.tab, row);

  return { code, row };
}

/**
 * Updates an MMRF and returns { code, row }.
 * `documents` is only the replacement MoU; leaving it empty keeps the old one.
 */
export async function updateMmrf({ code, values, documents, existing, user }) {
  requireWrite();

  const all = await readTab(MMRFS.tab).catch(() => []);
  assertMmrfNameFree(all, values, code);

  const patch = {
    ...mmrfFields(values),
    Updated_By: user?.id || "",
    Updated_On: new Date().toISOString(),
  };

  if (documents) {
    patch.MoU_File_Id = await uploadDocument({
      file: documents,
      name: `${code}_${values.MMRF_Name}_MoU.pdf`,
    });
  }

  await updateRow(MMRFS.tab, MMRFS.idColumn, code, patch);

  return { code, row: { ...existing, MMRF_Code: code, ...patch } };
}


/* ------------------------------------------------------------ vehicles (10) */

/** The vehicle columns that come from the form, shared by create and edit. */
function vehicleFields(values) {
  return {
    Registration_Number: values.Registration_Number.replace(/[s-]/g, "").toUpperCase(),
    Engine_Number: values.Engine_Number.trim().toUpperCase(),
    Chassis_Number: values.Chassis_Number.trim().toUpperCase(),
    Vehicle_Type: values.Vehicle_Type,
    Vehicle_Model: values.Vehicle_Model.trim(),
    Insurance_Validity_Date: values.Insurance_Validity_Date,
    // PUC is not applicable to an electric vehicle (section 10.1).
    PUC_Validity_Date: values.Vehicle_Type === "Electric" ? "" : values.PUC_Validity_Date,
    Fitness_Validity_Date: values.Fitness_Validity_Date,
    Registration_Validity_Date: values.Registration_Validity_Date,
  };
}

/** Registration, engine and chassis are unique; one code may be excused when editing. */
function assertVehicleUnique(existing, values, exceptCode) {
  const unique = [
    ["Registration_Number", "registration number"],
    ["Engine_Number", "engine number"],
    ["Chassis_Number", "chassis number"],
  ];
  for (const [column, label] of unique) {
    const value = String(values[column]).replace(/s/g, "").toUpperCase();
    const clash = existing.find(
      (r) =>
        String(r[column] || "").replace(/s/g, "").toUpperCase() === value &&
        String(r.Vehicle_Code || "") !== String(exceptCode || "")
    );
    if (clash) throw new Error(`${clash.Vehicle_Code} already has this ${label}.`);
  }
}

export async function createVehicle({ values, documents, user }) {
  requireWrite();
  const existing = await readTab(VEHICLES.tab).catch(() => []);
  assertVehicleUnique(existing, values);

  const code = nextCode(existing, "Vehicle_Code", "VH");
  const fields = vehicleFields(values);
  const link = await uploadDocument({
    file: documents,
    name: `${code}_${fields.Registration_Number}_documents.pdf`,
  });

  const row = {
    Vehicle_Code: code,
    ...fields,
    Documents_File_Id: link,
    Status: "Active",
    Created_By: user?.id || "",
    Created_On: new Date().toISOString(),
    Updated_By: "", Updated_On: "",
  };

  await appendRow(VEHICLES.tab, row);

  return { code, row };
}

/** Updates a vehicle. `documents` is only the replacement PDF. */
export async function updateVehicle({ code, values, documents, existing, user }) {
  requireWrite();

  const all = await readTab(VEHICLES.tab).catch(() => []);
  assertVehicleUnique(all, values, code);

  const fields = vehicleFields(values);
  const patch = {
    ...fields,
    Updated_By: user?.id || "",
    Updated_On: new Date().toISOString(),
  };

  if (documents) {
    patch.Documents_File_Id = await uploadDocument({
      file: documents,
      name: `${code}_${fields.Registration_Number}_documents.pdf`,
    });
  }

  await updateRow(VEHICLES.tab, VEHICLES.idColumn, code, patch);

  return { code, row: { ...existing, Vehicle_Code: code, ...patch } };
}


/* ------------------------------------------------------------- drivers (10) */

/** The driver columns that come from the form, shared by create and edit. */
function driverFields(values) {
  return {
    Driver_Name: values.Driver_Name.trim(),
    Licence_Number: values.Licence_Number.trim().toUpperCase(),
    Contact_Number: values.Contact_Number,
    Licence_Validity_Date: values.Licence_Validity_Date,
  };
}

function assertLicenceFree(existing, values, exceptCode) {
  const licence = values.Licence_Number.trim().toUpperCase();
  const clash = existing.find(
    (r) =>
      String(r.Licence_Number || "").trim().toUpperCase() === licence &&
      String(r.Driver_Code || "") !== String(exceptCode || "")
  );
  if (clash) throw new Error(`${clash.Driver_Code} already has this driving licence number.`);
}

export async function createDriver({ values, documents, user }) {
  requireWrite();
  const existing = await readTab(DRIVERS.tab).catch(() => []);
  assertLicenceFree(existing, values);

  const code = nextCode(existing, "Driver_Code", "DR");
  const link = await uploadDocument({
    file: documents,
    name: `${code}_${values.Driver_Name}_licence.pdf`,
  });

  const row = {
    Driver_Code: code,
    ...driverFields(values),
    Licence_File_Id: link,
    Status: "Active",
    Created_By: user?.id || "",
    Created_On: new Date().toISOString(),
    Updated_By: "", Updated_On: "",
  };

  await appendRow(DRIVERS.tab, row);

  return { code, row };
}

/** Updates a driver. `documents` is only the replacement licence copy. */
export async function updateDriver({ code, values, documents, existing, user }) {
  requireWrite();

  const all = await readTab(DRIVERS.tab).catch(() => []);
  assertLicenceFree(all, values, code);

  const patch = {
    ...driverFields(values),
    Updated_By: user?.id || "",
    Updated_On: new Date().toISOString(),
  };

  if (documents) {
    patch.Licence_File_Id = await uploadDocument({
      file: documents,
      name: `${code}_${values.Driver_Name}_licence.pdf`,
    });
  }

  await updateRow(DRIVERS.tab, DRIVERS.idColumn, code, patch);

  return { code, row: { ...existing, Driver_Code: code, ...patch } };
}

/**
 * Activate or deactivate any record (section 10.3).
 *
 * A deactivated vehicle or driver stays in the inventory and in past records,
 * but is not offered for new entries.
 */
export async function setRecordStatus({ tab, id, status, user }) {
  requireWrite();
  await updateRow(tab.tab, tab.idColumn, id, {
    Status: status,
    Updated_By: user?.id || "",
    Updated_On: new Date().toISOString(),
  });
  return { id, status };
}

