/**
 * Authentication against the Users tab of the Google Sheet.
 *
 * There are no built-in accounts. Every user — including the two Super Admins
 * required at go-live (section 17.1) — is a row in the Users tab.
 */

import { USERS, isDriveConfigured } from "../config/driveSchema";
import { ROLES } from "../config/appConfig";
import { readTab, updateRow } from "./sheetsApi";

const SESSION_KEY = "chintan.session";

const splitList = (value) =>
  String(value || "")
    .split(/[|,]/)
    .map((s) => s.trim())
    .filter(Boolean);

function toSession(row) {
  return {
    id: row.User_Id,
    name: row.Full_Name,
    username: row.Username,
    role: row.Role,
    sources: splitList(row.Assigned_Source_Types),
    areas: splitList(row.Assigned_Areas),
    mustChangePassword: String(row.Must_Change_Password).toUpperCase() === "YES",
    loggedInAt: new Date().toISOString(),
  };
}

export async function login(username, password) {
  const clean = String(username || "").trim();
  if (!clean || !password) throw new Error("Enter your username and password.");

  if (!isDriveConfigured()) {
    throw new Error(
      "No Google Sheet is connected, so there are no accounts to sign in with. " +
        "Set VITE_SHEET_ID in app/.env."
    );
  }

  const rows = await readTab(USERS.tab, { force: true });

  if (!rows.length) {
    throw new Error(
      "The Users tab is empty. Add a Super Admin row to the Google Sheet before signing in."
    );
  }

  const user = rows.find(
    (r) => String(r.Username || "").toLowerCase() === clean.toLowerCase()
  );
  if (!user) throw new Error("Username or password is incorrect.");

  if (String(user.Status || "Active").toLowerCase() !== "active") {
    throw new Error("This account is inactive. Ask the Super Admin to activate it.");
  }

  if (String(user.Password_Hash) !== String(password)) {
    throw new Error("Username or password is incorrect.");
  }

  const session = toSession(user);
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));

  updateRow(USERS.tab, USERS.idColumn, user.User_Id, {
    Last_Login: new Date().toISOString(),
  }).catch(() => {}); // a failed timestamp must never block the sign-in

  return session;
}

export function logout() {
  sessionStorage.removeItem(SESSION_KEY);
}

export function currentSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Re-read the signed-in user's row and return a fresh session.
 *
 * Role, assigned source types and assigned areas are copied into the session
 * at sign-in, so a Super Admin changing them leaves the user looking at stale
 * permissions — most visibly as a Supervisor still being told they have no
 * sources assigned. Refreshing on load picks the change up without anyone
 * having to know they must sign out and in again.
 *
 * Returns null when the account has gone or been deactivated, which signs
 * them out. Any other failure returns the existing session unchanged, so a
 * dropped connection does not throw people out.
 */
export async function refreshSession() {
  const current = currentSession();
  if (!current || !isDriveConfigured()) return current;

  try {
    const rows = await readTab(USERS.tab, { force: true });
    const row = rows.find((r) => String(r.User_Id) === String(current.id));
    if (!row) return null;
    if (String(row.Status || "Active").toLowerCase() === "inactive") return null;

    const session = { ...toSession(row), loggedInAt: current.loggedInAt };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  } catch {
    return current;
  }
}

export const ROLE_LIST = Object.values(ROLES);
