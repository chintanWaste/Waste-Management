/**
 * Chintan Waste Operations — write backend.
 *
 * The app reads the Sheet directly through the public CSV endpoint, but a
 * browser cannot write to a Sheet or to Drive on its own. Every write goes
 * through this Web App instead.
 *
 * Actions: append, appendMany, update, delete, upload.
 *
 * SET-UP — see apps-script/README.md. In short:
 *   1. Extensions > Apps Script from the Chintan_Waste_Data spreadsheet.
 *   2. Paste this file in, then set API_KEY and ROOT_FOLDER_ID below.
 *   3. Deploy > New deployment > Web app,
 *        "Execute as: Me", "Who has access: Anyone".
 *   4. Copy the /exec URL into VITE_SHEET_API_URL in .env.
 */

/** Must match VITE_SHEET_API_KEY in the app's .env. Pick any long random string. */
var API_KEY = 'CHANGE_ME_TO_A_LONG_RANDOM_STRING';

/** The Drive folder holding Documents/ and Photos/ — same as VITE_DRIVE_FOLDER_ID. */
var ROOT_FOLDER_ID = 'PASTE_THE_DRIVE_FOLDER_ID_HERE';

/** Rows soft-deleted from any tab are copied here. */
var DELETED_TAB = 'Deleted_Items';

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);

    if (body.key !== API_KEY) {
      return respond({ ok: false, error: 'Rejected: the API key does not match.' });
    }

    switch (body.action) {
      case 'append':     return respond(appendRow(body.tab, body.row));
      case 'appendMany': return respond(appendMany(body.tab, body.rows));
      case 'update':     return respond(updateRow(body.tab, body.idColumn, body.id, body.row));
      case 'delete':     return respond(deleteRow(body.tab, body.idColumn, body.id, body.context));
      case 'upload':     return respond(uploadFile(body.folder, body.name, body.mimeType, body.data));
      default:           return respond({ ok: false, error: 'Unknown action: ' + body.action });
    }
  } catch (err) {
    return respond({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

/** A GET is only ever a health check — it confirms the deployment is reachable. */
function doGet() {
  return respond({ ok: true, service: 'Chintan Waste write API' });
}

function respond(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

/* -------------------------------------------------------------------------- */
/*  Sheet helpers                                                             */
/* -------------------------------------------------------------------------- */

function sheetFor(tabName) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(tabName);
  if (!sheet) throw new Error('There is no tab named "' + tabName + '" in this spreadsheet.');
  return sheet;
}

function headersOf(sheet) {
  var width = sheet.getLastColumn();
  if (width === 0) throw new Error('The "' + sheet.getName() + '" tab has no header row.');
  return sheet.getRange(1, 1, 1, width).getValues()[0].map(function (h) {
    return String(h).trim();
  });
}

/**
 * Lay a { column: value } object out in the tab's own column order.
 *
 * Writing by header name rather than by position means adding a column to the
 * Sheet never silently shifts existing data into the wrong column.
 */
function toRowArray(headers, row) {
  return headers.map(function (header) {
    var value = row[header];
    return value === undefined || value === null ? '' : value;
  });
}

function appendRow(tabName, row) {
  var sheet = sheetFor(tabName);
  var headers = headersOf(sheet);
  sheet.appendRow(toRowArray(headers, row));
  SpreadsheetApp.flush();
  return { ok: true, rowNumber: sheet.getLastRow() };
}

function appendMany(tabName, rows) {
  if (!rows || !rows.length) return { ok: true, written: 0 };

  var sheet = sheetFor(tabName);
  var headers = headersOf(sheet);
  var values = rows.map(function (row) { return toRowArray(headers, row); });

  sheet.getRange(sheet.getLastRow() + 1, 1, values.length, headers.length).setValues(values);
  SpreadsheetApp.flush();
  return { ok: true, written: values.length };
}

/** Find the 1-based sheet row whose `idColumn` equals `id`, or 0. */
function findRowNumber(sheet, headers, idColumn, id) {
  var index = headers.indexOf(idColumn);
  if (index === -1) {
    throw new Error('The "' + sheet.getName() + '" tab has no "' + idColumn + '" column.');
  }
  if (sheet.getLastRow() < 2) return 0;

  var column = sheet.getRange(2, index + 1, sheet.getLastRow() - 1, 1).getValues();
  var wanted = String(id).trim();

  for (var i = 0; i < column.length; i++) {
    if (String(column[i][0]).trim() === wanted) return i + 2;
  }
  return 0;
}

/** Patch only the named columns; everything else on the row is left alone. */
function updateRow(tabName, idColumn, id, patch) {
  var sheet = sheetFor(tabName);
  var headers = headersOf(sheet);
  var rowNumber = findRowNumber(sheet, headers, idColumn, id);
  if (!rowNumber) throw new Error('No row in "' + tabName + '" has ' + idColumn + ' = ' + id + '.');

  var range = sheet.getRange(rowNumber, 1, 1, headers.length);
  var current = range.getValues()[0];

  headers.forEach(function (header, i) {
    if (Object.prototype.hasOwnProperty.call(patch, header)) current[i] = patch[header];
  });

  range.setValues([current]);
  SpreadsheetApp.flush();
  return { ok: true, rowNumber: rowNumber };
}

/**
 * Soft delete: the row stays where it is with Status = Deleted, and a copy is
 * written to Deleted_Items so nothing is ever actually lost.
 */
function deleteRow(tabName, idColumn, id, context) {
  var sheet = sheetFor(tabName);
  var headers = headersOf(sheet);
  var rowNumber = findRowNumber(sheet, headers, idColumn, id);
  if (!rowNumber) throw new Error('No row in "' + tabName + '" has ' + idColumn + ' = ' + id + '.');

  var values = sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];

  var archive = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DELETED_TAB);
  if (archive) {
    var snapshot = {};
    headers.forEach(function (header, i) { snapshot[header] = values[i]; });

    archive.appendRow(toRowArray(headersOf(archive), {
      Deletion_Id: Utilities.getUuid(),
      Record_Type: tabName,
      Record_Ref_Id: id,
      Record_Label: (context && context.label) || '',
      Record_Json: JSON.stringify(snapshot),
      Cascade_Json: (context && context.cascade) ? JSON.stringify(context.cascade) : '',
      Deleted_By: (context && context.user) || '',
      Deleted_On: new Date().toISOString()
    }));
  }

  var statusIndex = headers.indexOf('Status');
  if (statusIndex !== -1) {
    sheet.getRange(rowNumber, statusIndex + 1).setValue('Deleted');
  }

  SpreadsheetApp.flush();
  return { ok: true, rowNumber: rowNumber };
}

/* -------------------------------------------------------------------------- */
/*  Drive upload                                                              */
/* -------------------------------------------------------------------------- */

/** The named subfolder of the root folder, created on first use. */
function subFolder(name) {
  if (!ROOT_FOLDER_ID || ROOT_FOLDER_ID.indexOf('PASTE') === 0) {
    throw new Error('ROOT_FOLDER_ID is not set in the Apps Script.');
  }

  var root = DriveApp.getFolderById(ROOT_FOLDER_ID);
  var existing = root.getFoldersByName(name);
  return existing.hasNext() ? existing.next() : root.createFolder(name);
}

/** `data` is the base64 body of the file, without the data: URL prefix. */
function uploadFile(folder, name, mimeType, data) {
  if (!data) throw new Error('No file content was received.');

  var bytes = Utilities.base64Decode(data);
  var blob = Utilities.newBlob(bytes, mimeType || 'application/octet-stream', name || 'upload');
  var file = subFolder(folder || 'Documents').createFile(blob);

  return { ok: true, fileId: file.getId() };
}
