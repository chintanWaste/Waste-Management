/**
 * Read and write the Google Sheet that backs the application.
 *
 * Reads  → public gviz CSV endpoint, parsed with PapaParse.
 * Writes → Apps Script Web App (append / update / delete / upload).
 */

import Papa from "papaparse";
import {
  DRIVE, isDriveConfigured, isWriteConfigured, sheetCsvUrl, writeUrlProblem,
} from "../config/driveSchema";

const cache = new Map(); // tabName -> { at, rows }

const fresh = (entry) =>
  entry && Date.now() - entry.at < DRIVE.cacheMinutes * 60 * 1000;

/** Drop the cached copy of one tab, or of everything. */
export function invalidate(tabName) {
  if (tabName) cache.delete(tabName);
  else cache.clear();
}

/**
 * Read one tab as an array of plain objects keyed by the header row.
 * Empty trailing rows are discarded.
 */
export async function readTab(tabName, { force = false } = {}) {
  if (!isDriveConfigured()) {
    throw new Error(
      "Google Sheet is not connected yet. Set VITE_SHEET_ID in the .env file."
    );
  }

  const cached = cache.get(tabName);
  if (!force && fresh(cached)) return cached.rows;

  const res = await fetch(sheetCsvUrl(tabName), { redirect: "follow" });
  if (!res.ok) {
    throw new Error(`Could not read the "${tabName}" tab (HTTP ${res.status}).`);
  }

  const csv = await res.text();
  if (csv.trimStart().startsWith("<")) {
    throw new Error(
      `The Google Sheet is not shared publicly, so the "${tabName}" tab could not be read. ` +
        'Share it as "Anyone with the link — Viewer".'
    );
  }

  const parsed = Papa.parse(csv.trim(), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });

  const rows = parsed.data.filter((row) =>
    Object.values(row).some((v) => String(v ?? "").trim() !== "")
  );

  cache.set(tabName, { at: Date.now(), rows });
  return rows;
}

/** Read several tabs at once. Returns { tabName: rows }. */
export async function readTabs(tabNames, options) {
  const results = await Promise.all(
    tabNames.map((t) => readTab(t, options).catch(() => []))
  );
  return Object.fromEntries(tabNames.map((t, i) => [t, results[i]]));
}

/** Post an action to the Apps Script Web App. */
async function callApi(action, payload) {
  if (!isWriteConfigured()) {
    throw new Error(
      "Saving is not connected yet. Deploy the Apps Script Web App and set VITE_SHEET_API_URL."
    );
  }

  // Checked before the request: posting to the wrong Google page fails as an
  // opaque CORS error, which tells nobody what actually went wrong.
  const problem = writeUrlProblem();
  if (problem) throw new Error(problem);

  let res;
  try {
    res = await fetch(DRIVE.apiUrl, {
      method: "POST",
      // text/plain avoids a CORS preflight that Apps Script cannot answer.
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, key: DRIVE.apiKey, ...payload }),
    });
  } catch {
    /*
     * fetch only throws when the request never completed at all, and the
     * browser deliberately withholds the reason. In practice it is one of
     * these three, so say so rather than passing on "Failed to fetch".
     */
    throw new Error(
      `Could not reach the save endpoint at ${DRIVE.apiUrl} — the request was blocked ` +
        "before it completed. Usually this means the Web App is not deployed with " +
        '"Who has access: Anyone", the deployment has been deleted, or there is no ' +
        "network connection."
    );
  }

  if (!res.ok) throw new Error(`Save failed (HTTP ${res.status}).`);

  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "Save failed.");
  return data;
}

/** Append one row to a tab. `row` is keyed by column name. */
export async function appendRow(tabName, row) {
  const out = await callApi("append", { tab: tabName, row });
  invalidate(tabName);
  return out;
}

/** Append many rows (e.g. the category lines of one entry). */
export async function appendRows(tabName, rows) {
  const out = await callApi("appendMany", { tab: tabName, rows });
  invalidate(tabName);
  return out;
}

/** Update the row whose id column matches `id`. */
export async function updateRow(tabName, idColumn, id, patch) {
  const out = await callApi("update", { tab: tabName, idColumn, id, row: patch });
  invalidate(tabName);
  return out;
}

/** Soft-delete: sets Status to Deleted and copies the row to Deleted_Items. */
export async function deleteRow(tabName, idColumn, id, context = {}) {
  const out = await callApi("delete", { tab: tabName, idColumn, id, context });
  invalidate();
  return out;
}

/**
 * Put a list of values on one or more Sheet columns as a dropdown.
 *
 * `targets` is [{ tab, column }, ...]. Nothing is read or written in the
 * rows themselves — only the data-validation rule on the column changes.
 */
export async function setValidation(targets, values) {
  return callApi("validate", { targets, values });
}

/**
 * Upload a file to the Drive folder and get its file id back.
 * `file` is a File/Blob from an <input type="file">.
 */
export async function uploadFile(file, { folder = "Documents", name } = {}) {
  const base64 = await fileToBase64(file);
  const out = await callApi("upload", {
    folder,
    name: name || file.name,
    mimeType: file.type,
    data: base64,
  });
  return out.fileId;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
