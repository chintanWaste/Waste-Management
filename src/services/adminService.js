/**
 * Administration (specification section 17): users, approvals, deleted items
 * and settings.
 */

import {
  ALERTS, APPROVALS, BWG_CHARACTERISATION, DELETED_ITEMS, INWARD_RRR, INWARD_SPECIAL,
  SETTINGS, TAB_BY_NAME, USERS, isWriteConfigured, validationTargets,
} from "../config/driveSchema";
import { approvalWouldBreak } from "./approvalChecks";
import { replaceCategoryLines } from "./inwardService";
import { appendRow, readTab, setValidation, updateRow } from "./sheetsApi";
import { daysBetween, today } from "../utils/format";

function requireWrite() {
  if (!isWriteConfigured()) {
    throw new Error(
      "Saving is not connected yet. Deploy the Apps Script Web App and set " +
        "VITE_SHEET_API_URL in app/.env, then try again."
    );
  }
}

/* ------------------------------------------------------------ 17.1 users */

/** Minimum 8 characters with letters and numbers (section 17.1). */
export function generatePassword(length = 10) {
  const letters = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const all = letters + digits;

  const pick = (pool) => pool[Math.floor(Math.random() * pool.length)];
  const chars = [pick(letters), pick(letters.toUpperCase()), pick(digits), pick(digits)];
  while (chars.length < length) chars.push(pick(all));

  // Fisher–Yates, so the guaranteed characters are not always in front.
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

export function validatePassword(value) {
  const text = String(value || "");
  if (text.length < 8) return "Password must be at least 8 characters";
  if (!/[A-Za-z]/.test(text)) return "Password must contain letters";
  if (!/\d/.test(text)) return "Password must contain numbers";
  return "";
}

function nextUserId(rows) {
  let highest = 0;
  for (const row of rows) {
    const match = String(row.User_Id || "").match(/^U(\d+)$/);
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return `U${highest + 1}`;
}

export async function createUser({ values, user }) {
  requireWrite();
  const rows = await readTab(USERS.tab).catch(() => []);

  const username = values.Username.trim().toLowerCase();
  if (rows.some((r) => String(r.Username || "").trim().toLowerCase() === username)) {
    throw new Error(`The username "${values.Username}" is already taken.`);
  }

  const id = nextUserId(rows);
  const password = generatePassword();

  await appendRow(USERS.tab, {
    User_Id: id,
    Full_Name: values.Full_Name.trim(),
    Username: values.Username.trim(),
    Password_Hash: password,
    Role: values.Role,
    Assigned_Source_Types: (values.Assigned_Source_Types || []).join("|"),
    Assigned_Areas: (values.Assigned_Areas || []).join("|"),
    Phone: values.Phone || "",
    Email: values.Email || "",
    Must_Change_Password: "Yes",
    Status: "Active",
    Last_Login: "",
    Created_By: user?.id || "",
    Created_On: new Date().toISOString(),
  });

  // Shown once, at creation (section 17.1).
  return { id, password };
}

/**
 * Changes a user's details, role and what they may work on (section 17.1).
 *
 * Username and password are left alone: a username identifies the account in
 * the audit log, and a password is only ever set by a reset, never read.
 *
 * Assigning source types is what makes a Supervisor's screens work at all —
 * with none assigned, Inward, Stock and Dispatch have nothing to show.
 */
export async function updateUser({ userId, values, user }) {
  requireWrite();

  await updateRow(USERS.tab, USERS.idColumn, userId, {
    Full_Name: values.Full_Name.trim(),
    Role: values.Role,
    Assigned_Source_Types: (values.Assigned_Source_Types || []).join("|"),
    Assigned_Areas: (values.Assigned_Areas || []).join("|"),
    Phone: values.Phone || "",
    Email: values.Email || "",
    Updated_By: user?.id || "",
    Updated_On: new Date().toISOString(),
  });

  return { id: userId };
}

export async function setUserStatus({ userId, status }) {
  requireWrite();
  await updateRow(USERS.tab, USERS.idColumn, userId, { Status: status });
}

export async function resetUserPassword({ userId }) {
  requireWrite();
  const password = generatePassword();
  await updateRow(USERS.tab, USERS.idColumn, userId, {
    Password_Hash: password,
    Must_Change_Password: "Yes",
  });
  return password;
}

/* -------------------------------------------------------- 17.2 approvals */

/** How many days after creation a Supervisor may still edit an entry (3.2). */
export const SUPERVISOR_EDIT_DAYS = 3;

/**
 * Where a pending edit keeps its proposed category break-up.
 *
 * Categories live in their own tab, not on the entry, so they cannot ride
 * along as ordinary columns. Prefixed so it can never collide with a real
 * column name, and stripped before the patch is written to the record.
 */
const CATEGORY_KEY = "__categories";

/**
 * Which source type an inward tab's category lines are filed under.
 *
 * Entry_Categories is one tab for every source, told apart by Source_Type,
 * so replacing an entry's lines needs the source its tab represents.
 */
const SOURCE_FOR_TAB = {
  [INWARD_RRR.tab]: "RRR",
  [INWARD_SPECIAL.tab]: "SPECIAL",
  [BWG_CHARACTERISATION.tab]: "BWG",
};

/**
 * Whether a Supervisor may still edit this entry (section 3.2).
 *
 * The window runs from when the entry was created, not from its collection
 * date: the point is to let someone correct their own recent mistake, not to
 * reopen old records.
 */
export function withinSupervisorEditWindow(row, days = SUPERVISOR_EDIT_DAYS) {
  const since = daysBetween(row?.Created_On, today());
  return since !== null && since <= days;
}

/** The columns that actually differ, so an approval shows only real changes. */
function changedFields(oldValues, newValues) {
  const out = { before: {}, after: {} };
  for (const key of Object.keys(newValues)) {
    if (String(oldValues?.[key] ?? "") === String(newValues[key] ?? "")) continue;
    out.before[key] = oldValues?.[key] ?? "";
    out.after[key] = newValues[key];
  }
  return out;
}

/**
 * Section 3.3 — a Supervisor's edit is saved as a pending change, not applied.
 *
 * The record itself keeps its original values, so stock, the dashboard and
 * reports carry on using the figures that were approved; only
 * Approval_Status is set, to mark it as having an edit awaiting a decision.
 * decideApproval() is what writes the new values, if the Super Admin agrees.
 */
export async function requestApproval({
  tab, recordId, oldValues, newValues, changeType = "Edit", categories, user,
}) {
  requireWrite();

  const { before, after } = changedFields(oldValues, newValues);
  if (Object.keys(after).length === 0) {
    throw new Error("Nothing was changed, so there is nothing to send for approval.");
  }

  /*
   * A categorised total carries its new break-up with it (sections 3.3 and
   * 12.4). It travels inside the approval rather than being written now,
   * because the old categories must stay in use until the edit is approved,
   * exactly as the old total does. CATEGORY_KEY is stripped before the rest
   * is applied to the record, so it never becomes a column.
   */
  const payload = categories?.length ? { ...after, [CATEGORY_KEY]: categories } : after;

  const rows = await readTab(APPROVALS.tab).catch(() => []);
  const pending = rows.find(
    (r) =>
      String(r.Record_Ref_Id) === String(recordId) &&
      String(r.Record_Type) === tab.tab &&
      !String(r.Decision || "").trim()
  );
  if (pending) {
    throw new Error(
      `${recordId} already has an edit waiting for approval. ` +
        "It must be approved or rejected before another change can be sent."
    );
  }

  const id = `AP${Date.now().toString(36).toUpperCase()}`;

  await appendRow(APPROVALS.tab, {
    Approval_Id: id,
    Record_Type: tab.tab,
    Record_Ref_Id: recordId,
    Change_Type: changeType,
    Old_Values_Json: JSON.stringify(before),
    New_Values_Json: JSON.stringify(payload),
    Requested_By: user?.id || "",
    Requested_On: new Date().toISOString(),
    Decision: "",
    Decision_Remark: "",
    Decided_By: "",
    Decided_On: "",
  });

  // Flags the entry as having a change pending. Its values are untouched.
  await updateRow(tab.tab, tab.idColumn, recordId, { Approval_Status: "Pending" });

  // "An alert is raised for every pending edit" (section 3.3).
  try {
    await appendRow(ALERTS.tab, {
      Alert_Id: `AL${Date.now().toString(36).toUpperCase()}`,
      Alert_Type: "Pending approval",
      Severity: "Info",
      Title: `Edit awaiting approval: ${recordId}`,
      Message:
        `${Object.keys(after).join(", ")} changed on ${recordId}. ` +
        "The original values stay in use until this is approved.",
      Related_Record_Type: tab.tab,
      Related_Record_Id: recordId,
      Area: oldValues?.Area || "",
      Source_Type: "",
      Raised_On: new Date().toISOString(),
      Status: "Open",
      Closed_By: "",
      Closed_On: "",
    });
  } catch {
    // An alert is a notification, not the record itself. If the Alerts tab is
    // missing, the edit must still reach the Super Admin through Approvals.
  }

  return { approvalId: id, fields: Object.keys(after) };
}

/**
 * Save an edit to an inward or dispatch entry, by whoever is making it.
 *
 * A Super Admin's edit is written straight away; a Supervisor's becomes a
 * pending approval, and only inside the three-day window (section 3.2).
 * Returns what happened so the screen can say so.
 */
export async function saveEntryEdit({
  tab, recordId, record, newValues, categories, isSuperAdmin, user,
}) {
  requireWrite();

  if (isSuperAdmin) {
    await updateRow(tab.tab, tab.idColumn, recordId, {
      ...newValues,
      Updated_By: user?.id || "",
      Updated_On: new Date().toISOString(),
    });

    // Nothing to approve, so the new break-up replaces the old one at once.
    if (categories?.length) {
      await replaceCategoryLines({
        sourceType: SOURCE_FOR_TAB[tab.tab] || "",
        entryRefId: recordId,
        collectionDate: record?.Collection_Date,
        lines: categories,
        user,
      });
    }

    return { applied: true };
  }

  if (!withinSupervisorEditWindow(record)) {
    throw new Error(
      `${recordId} was created more than ${SUPERVISOR_EDIT_DAYS} days ago, so it can no ` +
        "longer be edited. Ask a Super Admin to make the change."
    );
  }

  const { approvalId } = await requestApproval({
    tab, recordId, oldValues: record, newValues, categories, user,
  });

  return { applied: false, approvalId };
}

/**
 * Section 3.3 — the original values stay in use until approval, so approving
 * is what writes the new values onto the record.
 */
export async function decideApproval({ approval, decision, remark, user }) {
  requireWrite();

  if (decision === "Approved") {
    const tab = TAB_BY_NAME[approval.Record_Type];
    if (!tab) throw new Error(`Unknown record type "${approval.Record_Type}".`);

    let patch = {};
    try {
      patch = JSON.parse(approval.New_Values_Json || "{}");
    } catch {
      throw new Error("The pending change could not be read — reject it and ask for a fresh edit.");
    }

    // The category break-up travels with the edit but is not a column.
    const categories = patch[CATEGORY_KEY];
    delete patch[CATEGORY_KEY];

    /*
     * Section 3.3 — re-checked at the moment of approval, not when the edit
     * was requested. Stock and certificates move in between, so a change that
     * was harmless when submitted can break the books by the time it is
     * decided.
     */
    const rows = await readTab(tab.tab, { force: true }).catch(() => []);
    const record = rows.find(
      (r) => String(r[tab.idColumn]) === String(approval.Record_Ref_Id)
    );
    if (!record) {
      throw new Error(
        `${approval.Record_Ref_Id} no longer exists, so this change cannot be applied. Reject it.`
      );
    }

    const problem = await approvalWouldBreak({
      recordType: approval.Record_Type,
      record,
      patch,
    });
    if (problem) throw new Error(problem);

    await updateRow(tab.tab, tab.idColumn, approval.Record_Ref_Id, {
      ...patch,
      Approval_Status: "Approved",
      Updated_By: user?.id || "",
      Updated_On: new Date().toISOString(),
    });

    /*
     * The break-up is swapped only now, with the total — the two have to move
     * together or stock would be built from categories that no longer add up
     * to their entry.
     */
    if (categories?.length) {
      await replaceCategoryLines({
        sourceType: SOURCE_FOR_TAB[approval.Record_Type] || "",
        entryRefId: approval.Record_Ref_Id,
        collectionDate: record.Collection_Date,
        lines: categories,
        user,
      });
    }
  } else {
    const tab = TAB_BY_NAME[approval.Record_Type];
    if (tab) {
      await updateRow(tab.tab, tab.idColumn, approval.Record_Ref_Id, {
        Approval_Status: "Rejected",
      });
    }
  }

  await updateRow(APPROVALS.tab, APPROVALS.idColumn, approval.Approval_Id, {
    Decision: decision,
    Decision_Remark: remark || "",
    Decided_By: user?.id || "",
    Decided_On: new Date().toISOString(),
  });
}

/* ---------------------------------------------------- 17.2 deleted items */

/** Days left before a deleted record is removed for good (section 4.7). */
export function daysLeft(row, retentionDays = 7) {
  if (row.Purge_On) {
    const left = daysBetween(today(), row.Purge_On);
    return left === null ? null : Math.max(0, left);
  }
  const since = daysBetween(row.Deleted_On, today());
  return since === null ? null : Math.max(0, retentionDays - since);
}

export async function restoreDeleted({ row, user }) {
  requireWrite();

  const tab = TAB_BY_NAME[row.Record_Type];
  if (!tab) throw new Error(`Unknown record type "${row.Record_Type}".`);

  if (daysLeft(row) === 0) {
    throw new Error("This record is past its 7-day window and can no longer be restored.");
  }

  await updateRow(tab.tab, tab.idColumn, row.Record_Ref_Id, { Status: "Active" });

  await updateRow(DELETED_ITEMS.tab, DELETED_ITEMS.idColumn, row.Deletion_Id, {
    Restored_By: user?.id || "",
    Restored_On: new Date().toISOString(),
  });
}

/* --------------------------------------------------------- 17.4 settings */

/**
 * Write one setting.
 *
 * A setting may have no row yet — the application falls back to its built-in
 * default until someone changes it — so this appends when the key is new and
 * updates when it already exists.
 */
export async function saveSetting({ key, value, description, user }) {
  requireWrite();

  const rows = await readTab(SETTINGS.tab).catch(() => []);
  const exists = rows.some((r) => String(r.Setting_Key || "").trim() === key);

  const stamp = {
    Updated_By: user?.id || "",
    Updated_On: new Date().toISOString(),
  };

  if (exists) {
    await updateRow(SETTINGS.tab, SETTINGS.idColumn, key, {
      Setting_Value: value,
      ...stamp,
    });
    return;
  }

  await appendRow(SETTINGS.tab, {
    Setting_Key: key,
    Setting_Value: value,
    Description: description || "",
    ...stamp,
  });
}

/**
 * Save a dropdown list back to the Sheet as one pipe-separated cell, and put
 * the same values on the Sheet's own columns as a data-validation dropdown.
 *
 * The validation is a second step on purpose: the list itself is saved even if
 * the Apps Script deployment is older than the `validate` action, and the
 * caller is told which of the two happened rather than seeing the whole save
 * reported as failed.
 */
export async function saveList({ key, values, description, user }) {
  const clean = values.map((v) => String(v).trim()).filter(Boolean);
  if (!clean.length) throw new Error("A list must have at least one value.");

  await saveSetting({ key, value: clean.join("|"), description, user });

  const targets = validationTargets(key);
  if (!targets.length) {
    return { count: clean.length, columns: 0, dropdownError: "" };
  }

  try {
    const out = await setValidation(targets, clean);
    return { count: clean.length, columns: out.applied || 0, dropdownError: "" };
  } catch (err) {
    return { count: clean.length, columns: 0, dropdownError: err.message };
  }
}

/**
 * Re-apply every master list to the Sheet's columns.
 *
 * Used once after the Apps Script is updated, to put the dropdowns on columns
 * that were created before this existed — including the fixed lists, which are
 * never saved from the Settings page but still belong on the Sheet.
 */
export async function rebuildSheetDropdowns(listsByKey) {
  requireWrite();

  let columns = 0;
  const failed = [];

  for (const [key, values] of Object.entries(listsByKey)) {
    const targets = validationTargets(key);
    const clean = (values || []).map((v) => String(v).trim()).filter(Boolean);
    if (!targets.length || !clean.length) continue;

    try {
      const out = await setValidation(targets, clean);
      columns += out.applied || 0;
    } catch (err) {
      failed.push(`${key}: ${err.message}`);
    }
  }

  if (failed.length) throw new Error(failed.join("; "));
  return columns;
}

export async function saveSettings({ changes, user }) {
  for (const [key, value] of Object.entries(changes)) {
    await saveSetting({ key, value, user });
  }
  return Object.keys(changes).length;
}
