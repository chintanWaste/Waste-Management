/**
 * The waste category master (specification sections 4.2 and 17.3).
 *
 * One tab, Waste_Categories, feeds inward entry, stock, dispatch, certificates,
 * the dashboard and every report, so a change here reaches the whole
 * application. Entry_Categories and Dispatch_Lines store a line's category by
 * Category_Id, which is why an id is never reused and a category that has been
 * used is deactivated rather than deleted.
 */

import {
  DISPATCH_LINES, ENTRY_CATEGORIES, WASTE_CATEGORIES, isWriteConfigured, WRITE_NOT_CONFIGURED,
} from "../config/driveSchema";
import { appendRow, deleteRow, readTab, updateRow } from "./sheetsApi";

/** The two units a category can be counted in (section 4.2). */
export const UNITS = ["Kg", "Litre"];

/** Annex C — whether dispatching this category needs a vendor certificate. */
export const CERTIFICATE_REQUIREMENTS = ["Required", "Not Required"];

export const STATUSES = ["Active", "Inactive"];

function requireWrite() {
  if (!isWriteConfigured()) {
    throw new Error(
      WRITE_NOT_CONFIGURED
    );
  }
}

const clean = (value) => String(value ?? "").trim();
const fold = (value) => clean(value).toLowerCase().replace(/\s+/g, " ");

/**
 * The next Category_Id, in whatever shape the sheet already uses.
 *
 * The 60 rows of Annex B are imported from a template rather than created
 * here, so the prefix and any zero padding ("C7", "CAT007") are read off the
 * existing ids instead of being assumed. Ids are never reused, so this takes
 * the highest number rather than the first gap.
 */
export function nextCategoryId(rows) {
  let prefix = "CAT";
  let width = 0;
  let highest = 0;
  let seen = false;

  for (const row of rows) {
    const match = clean(row[WASTE_CATEGORIES.idColumn]).match(/^([A-Za-z_-]*?)(\d+)$/);
    if (!match) continue;

    const [, found, digits] = match;
    if (!seen) {
      prefix = found;
      seen = true;
    }
    // Only ids sharing the sheet's own prefix count towards the next number.
    if (found !== prefix) continue;

    width = Math.max(width, digits.length);
    highest = Math.max(highest, Number(digits));
  }

  const next = String(highest + 1);
  return prefix + (next.length < width ? next.padStart(width, "0") : next);
}

/** Continue the master's own numbering rather than restarting at 1. */
function nextSerial(rows) {
  let highest = 0;
  for (const row of rows) {
    highest = Math.max(
      highest,
      Number(row.Serial_No) || 0,
      Number(row.Sort_Order) || 0
    );
  }
  return highest + 1;
}

/**
 * The existing category with this name in the same material group, if any.
 *
 * Two groups may legitimately hold a similarly named category, so a name is
 * only a duplicate within its own group. `exceptId` lets an edit keep its own
 * name. Matching ignores case and extra spaces, which is how someone retyping
 * a category by hand actually creates a duplicate.
 */
export function duplicateCategory(rows, { group, name }, exceptId = "") {
  const wantedGroup = fold(group);
  const wantedName = fold(name);

  return rows.find(
    (row) =>
      clean(row[WASTE_CATEGORIES.idColumn]) !== clean(exceptId) &&
      fold(row.Material_Group) === wantedGroup &&
      fold(row.Waste_Category) === wantedName
  );
}

/** The columns a category form owns, shared by create and edit. */
function categoryFields(values) {
  return {
    Waste_Stream: clean(values.Waste_Stream),
    Material_Group: clean(values.Material_Group),
    Waste_Category: clean(values.Waste_Category),
    Unit: clean(values.Unit) || "Kg",
    Certificate_Requirement: clean(values.Certificate_Requirement),
  };
}

/**
 * The master as it stands in the sheet right now.
 *
 * A screen's own copy can be minutes old (the CSV reads are cached), and both
 * the next id and the duplicate check have to be decided against what is
 * actually there — a stale copy would hand out an id a second person has just
 * taken. The screen's copy is the fallback if the read fails.
 */
async function currentMaster(rows) {
  try {
    return await readTab(WASTE_CATEGORIES.tab, { force: true });
  } catch {
    return rows || [];
  }
}

export async function createCategory({ values, rows }) {
  requireWrite();

  const existing = await currentMaster(rows);

  const clash = duplicateCategory(existing, values);
  if (clash) {
    throw new Error(
      `"${clash.Waste_Category}" is already a category under ${clash.Material_Group} ` +
        `(${clash[WASTE_CATEGORIES.idColumn]}). Use that one, or give this a different name.`
    );
  }

  const id = nextCategoryId(existing);
  const serial = nextSerial(existing);

  const row = {
    [WASTE_CATEGORIES.idColumn]: id,
    Serial_No: serial,
    ...categoryFields(values),
    Sort_Order: serial,
    Status: "Active",
    Created_On: new Date().toISOString(),
    Updated_On: "",
  };

  await appendRow(WASTE_CATEGORIES.tab, row);
  return { id, row };
}

/**
 * Change a category.
 *
 * Only the master row is rewritten. Entry_Categories and Dispatch_Lines keep
 * their own copy of the wording as it stood when the entry was made, so a
 * rename reads through to new entries while history keeps the old label. The
 * figures are unaffected either way: both tabs are keyed on Category_Id.
 */
export async function updateCategory({ categoryId, values, rows }) {
  requireWrite();

  const existing = await currentMaster(rows);

  const clash = duplicateCategory(existing, values, categoryId);
  if (clash) {
    throw new Error(
      `"${clash.Waste_Category}" is already a category under ${clash.Material_Group} ` +
        `(${clash[WASTE_CATEGORIES.idColumn]}).`
    );
  }

  await updateRow(WASTE_CATEGORIES.tab, WASTE_CATEGORIES.idColumn, categoryId, {
    ...categoryFields(values),
    Status: clean(values.Status) || "Active",
    Updated_On: new Date().toISOString(),
  });

  return { id: categoryId };
}

/** Hide a category from new entries, or bring it back (section 17.3). */
export async function setCategoryStatus({ categoryId, status }) {
  requireWrite();

  await updateRow(WASTE_CATEGORIES.tab, WASTE_CATEGORIES.idColumn, categoryId, {
    Status: status,
    Updated_On: new Date().toISOString(),
  });
}

/**
 * How many inward lines and dispatch lines are filed under this category.
 *
 * Read fresh, not from the cached copy a screen already holds: the answer
 * decides whether a record is destroyed, so it must reflect the sheet now.
 *
 * A failed read is deliberately not treated as "used by nothing" — that would
 * turn a network error into permission to delete a category the entries still
 * depend on. The error is raised instead, and the caller refuses the delete.
 */
export async function categoryUsage({ categoryId }) {
  const wanted = clean(categoryId);
  const [entryLines, dispatchLines] = await Promise.all([
    readTab(ENTRY_CATEGORIES.tab, { force: true }),
    readTab(DISPATCH_LINES.tab, { force: true }),
  ]);

  const entries = entryLines.filter((r) => clean(r.Category_Id) === wanted).length;
  const dispatches = dispatchLines.filter((r) => clean(r.Category_Id) === wanted).length;

  return { entries, dispatches, total: entries + dispatches };
}

/**
 * Delete a category that has never been used.
 *
 * Section 17.3 — a category already recorded against entries cannot be
 * deleted, because stock, dispatch and the certificates built on those lines
 * would be left pointing at a category that no longer exists. Deactivating it
 * keeps the history intact and takes it out of new entries, which is what the
 * request actually means.
 */
export async function deleteCategory({ row, user }) {
  requireWrite();

  const categoryId = clean(row[WASTE_CATEGORIES.idColumn]);
  const { entries, dispatches, total } = await categoryUsage({ categoryId });

  if (total > 0) {
    const parts = [];
    if (entries) parts.push(`${entries} inward ${entries === 1 ? "line" : "lines"}`);
    if (dispatches) parts.push(`${dispatches} dispatch ${dispatches === 1 ? "line" : "lines"}`);

    throw new Error(
      `${row.Waste_Category} is already used by ${parts.join(" and ")}, so it cannot be ` +
        "deleted — deleting it would leave those figures pointing at a category that no " +
        "longer exists. Deactivate it instead: it then stays in history but is not offered " +
        "in new entries."
    );
  }

  await deleteRow(WASTE_CATEGORIES.tab, WASTE_CATEGORIES.idColumn, categoryId, {
    label: `${categoryId} — ${row.Waste_Category}`,
    user: user?.id || "",
  });

  return { id: categoryId };
}
