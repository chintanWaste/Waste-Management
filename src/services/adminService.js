/**
 * Administration (specification section 17): users, approvals, deleted items
 * and settings.
 */

import {
  APPROVALS, DELETED_ITEMS, SETTINGS, TAB_BY_NAME, USERS, isWriteConfigured,
} from "../config/driveSchema";
import { appendRow, readTab, updateRow } from "./sheetsApi";
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

    await updateRow(tab.tab, tab.idColumn, approval.Record_Ref_Id, {
      ...patch,
      Approval_Status: "Approved",
      Updated_By: user?.id || "",
      Updated_On: new Date().toISOString(),
    });
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

/** Save a dropdown list back to the Sheet as one pipe-separated cell. */
export async function saveList({ key, values, description, user }) {
  const clean = values.map((v) => String(v).trim()).filter(Boolean);
  if (!clean.length) throw new Error("A list must have at least one value.");

  await saveSetting({ key, value: clean.join("|"), description, user });
  return clean.length;
}

export async function saveSettings({ changes, user }) {
  for (const [key, value] of Object.entries(changes)) {
    await saveSetting({ key, value, user });
  }
  return Object.keys(changes).length;
}
