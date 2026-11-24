/**
 * Inward entry (specification section 12).
 *
 * The categorisation lines of an entry live in Entry_Categories, keyed by
 * Source_Type + Entry_Ref_Id, so the 60-category master can change without
 * reshaping any tab (section 4.2).
 */

import {
  BWG_CHARACTERISATION, ENTRY_CATEGORIES, INWARD_BWG, INWARD_MMRF,
  INWARD_RRR, INWARD_SPECIAL, isWriteConfigured,
} from "../config/driveSchema";
import { appendRow, appendRows, deleteRow, readTab, uploadFile } from "./sheetsApi";

function requireWrite() {
  if (!isWriteConfigured()) {
    throw new Error(
      "Saving is not connected yet. Deploy the Apps Script Web App and set " +
        "VITE_SHEET_API_URL in app/.env, then try again."
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

const isLive = (row) => String(row.Status || "Active").toLowerCase() !== "deleted";

/* ------------------------------------------------- 12.2  MMRF inward entry */

/** One entry per MMRF per date; a whole area is submitted together. */
export async function saveMmrfInward({ collectionDate, area, lines, user }) {
  requireWrite();
  const existing = await readTab(INWARD_MMRF.tab).catch(() => []);

  const clash = existing.find(
    (r) => isLive(r) && r.Collection_Date === collectionDate && r.Area === area
  );
  if (clash) {
    throw new Error(
      `An entry already exists for ${area} on ${collectionDate}. Open it to edit instead.`
    );
  }

  let counter = Number(nextId(existing, "Entry_Id", "IM").slice(2));
  const batchId = `IMB-${area}-${collectionDate.replace(/-/g, "")}`;
  const now = new Date().toISOString();

  const rows = lines.map((line) => ({
    Entry_Id: `IM${counter++}`,
    Collection_Date: collectionDate,
    Area: area,
    MMRF_Code: line.code,
    Waste_Collected_Kg: line.kg,
    Batch_Id: batchId,
    Status: "Active",
    Created_By: user?.id || "",
    Created_On: now,
    Updated_By: "", Updated_On: "", Approval_Status: "",
  }));

  await appendRows(INWARD_MMRF.tab, rows);
  return { batchId, count: rows.length };
}

/* -------------------------------------------- 12.3  RRR on Wheels inward */

/** One entry per vehicle per date, all trips added into one total. */
export async function saveRrrInward({ values, photos, user }) {
  requireWrite();
  const existing = await readTab(INWARD_RRR.tab).catch(() => []);

  const clash = existing.find(
    (r) =>
      isLive(r) &&
      r.Collection_Date === values.Collection_Date &&
      r.Vehicle_Code === values.Vehicle_Code
  );
  if (clash) {
    throw new Error(
      "An entry exists for this vehicle on this date – edit it instead."
    );
  }

  const entryId = nextId(existing, "Entry_Id", "IR");
  const fileIds = await uploadPhotos(photos, entryId);

  await appendRow(INWARD_RRR.tab, {
    Entry_Id: entryId,
    Collection_Date: values.Collection_Date,
    Vehicle_Code: values.Vehicle_Code,
    Driver_Code: values.Driver_Code,
    Area: values.Area,
    Total_Waste_Collected_Kg: values.Total_Waste_Collected_Kg,
    Photo_File_Ids: fileIds.join("|"),
    Categorisation_Status: "Pending",
    Status: "Active",
    Created_By: user?.id || "",
    Created_On: new Date().toISOString(),
    Updated_By: "", Updated_On: "", Approval_Status: "",
  });

  return entryId;
}

/* ------------------------------------------------ 12.5  BWG daily inward */

/**
 * One row per BWG per date. The vendor linked on that date is written onto
 * each row, so re-linking later never changes this day's vendor totals.
 */
export async function saveBwgInward({ collectionDate, area, lines, photo, user }) {
  requireWrite();
  const existing = await readTab(INWARD_BWG.tab).catch(() => []);

  const clash = existing.find(
    (r) => isLive(r) && r.Collection_Date === collectionDate && r.Area === area
  );
  if (clash) {
    throw new Error(
      `An entry already exists for ${area} on ${collectionDate}. Open it to edit instead.`
    );
  }

  const batchId = `IBB-${area}-${collectionDate.replace(/-/g, "")}`;
  const photoId = photo
    ? await uploadFile(photo, { folder: "Photos", name: `${batchId}.jpg` })
    : "";

  let counter = Number(nextId(existing, "Entry_Id", "IB").slice(2));
  const now = new Date().toISOString();

  const rows = lines.map((line) => ({
    Entry_Id: `IB${counter++}`,
    Batch_Id: batchId,
    Collection_Date: collectionDate,
    Area: area,
    BWG_Code: line.bwgCode,
    Vendor_Code: line.vendorCode,
    Waste_Collected_Kg: line.kg,
    Photo_File_Id: photoId,
    Status: "Active",
    Created_By: user?.id || "",
    Created_On: now,
    Updated_By: "", Updated_On: "", Approval_Status: "",
  }));

  await appendRows(INWARD_BWG.tab, rows);
  return { batchId, count: rows.length };
}

/* ------------------------------------------ 12.7  Special collection entry */

export async function saveSpecialInward({ values, photos, user }) {
  requireWrite();
  const existing = await readTab(INWARD_SPECIAL.tab).catch(() => []);

  const entryCode = nextId(existing, "Entry_Code", "SC");
  const fileIds = await uploadPhotos(photos, entryCode);
  const byVendor = values.Collected_By === "Vendor";

  await appendRow(INWARD_SPECIAL.tab, {
    Entry_Code: entryCode,
    Collection_Date: values.Collection_Date,
    Location: values.Location.trim(),
    Area: values.Area,
    Contact_Person: values.Contact_Person.trim(),
    Phone: values.Phone,
    Email: values.Email.trim(),
    Collected_By: values.Collected_By,
    Vendor_Code: byVendor ? values.Vendor_Code : "",
    Vehicle_Code: byVendor ? "" : values.Vehicle_Code,
    Driver_Code: byVendor ? "" : values.Driver_Code,
    Total_Waste_Collected_Kg: values.Total_Waste_Collected_Kg,
    Photo_File_Ids: fileIds.join("|"),
    Categorisation_Status: "Pending",
    Status: "Active",
    Created_By: user?.id || "",
    Created_On: new Date().toISOString(),
    Updated_By: "", Updated_On: "", Approval_Status: "",
  });

  return entryCode;
}

/* ------------------------------- 12.6  BWG characterisation, per vendor/day */

export async function saveCharacterisation({ collectionDate, vendorCode, totalKg, bwgCount, user }) {
  requireWrite();
  const existing = await readTab(BWG_CHARACTERISATION.tab).catch(() => []);

  const clash = existing.find(
    (r) => isLive(r) && r.Collection_Date === collectionDate && r.Vendor_Code === vendorCode
  );
  if (clash) return clash.Characterisation_Id;

  const id = nextId(existing, "Characterisation_Id", "BC");

  await appendRow(BWG_CHARACTERISATION.tab, {
    Characterisation_Id: id,
    Collection_Date: collectionDate,
    Vendor_Code: vendorCode,
    Total_Collected_Kg: totalKg,
    Number_Of_BWGs: bwgCount,
    Characterisation_Status: "Pending",
    Status: "Active",
    Created_By: user?.id || "",
    Created_On: new Date().toISOString(),
    Updated_By: "", Updated_On: "", Approval_Status: "",
  });

  return id;
}

/* --------------------------------------- 12.4  the categorisation lines */

/**
 * Writes the category break-up of one entry. The caller has already checked
 * that the lines add up exactly to the entry's total.
 */
export async function saveCategoryLines({ sourceType, entryRefId, collectionDate, lines, user }) {
  requireWrite();
  const existing = await readTab(ENTRY_CATEGORIES.tab).catch(() => []);

  let counter = Number(nextId(existing, "Line_Id", "EC").slice(2));
  const now = new Date().toISOString();

  const rows = lines
    .filter((line) => Number(line.quantityKg) > 0)
    .map((line) => ({
      Line_Id: `EC${counter++}`,
      Source_Type: sourceType,
      Entry_Ref_Id: entryRefId,
      Collection_Date: collectionDate,
      Category_Id: line.categoryId,
      Waste_Category: line.name,
      Material_Group: line.group,
      Waste_Stream: line.stream,
      Quantity_Entered: line.quantityEntered,
      Unit: line.unit,
      Quantity_Kg: line.quantityKg,
      Created_By: user?.id || "",
      Created_On: now,
    }));

  await appendRows(ENTRY_CATEGORIES.tab, rows);
  return rows.length;
}

/**
 * Swap an entry's category break-up for a new one (sections 3.3 and 12.4).
 *
 * Editing a categorised total means its categories must be re-entered, so the
 * old lines have to go. They are removed one at a time because a line carries
 * no status column to retire it with, and each removal is archived like any
 * other delete.
 */
export async function replaceCategoryLines({
  sourceType, entryRefId, collectionDate, lines, user,
}) {
  requireWrite();

  const existing = await readTab(ENTRY_CATEGORIES.tab).catch(() => []);
  const mine = existing.filter(
    (row) =>
      String(row.Entry_Ref_Id) === String(entryRefId) &&
      String(row.Source_Type) === String(sourceType)
  );

  for (const row of mine) {
    await deleteRow(ENTRY_CATEGORIES.tab, ENTRY_CATEGORIES.idColumn, row.Line_Id, {
      label: `${entryRefId} ${row.Waste_Category}`,
      user: user?.id || "",
    });
  }

  const written = await saveCategoryLines({
    sourceType, entryRefId, collectionDate, lines, user,
  });

  return { removed: mine.length, written };
}

async function uploadPhotos(photos = [], prefix) {
  const ids = [];
  for (let i = 0; i < photos.length; i += 1) {
    const extension = photos[i].name.split(".").pop() || "jpg";
    ids.push(
      await uploadFile(photos[i], {
        folder: "Photos",
        name: `${prefix}_${i + 1}.${extension}`,
      })
    );
  }
  return ids;
}
