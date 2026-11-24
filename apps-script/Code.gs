/**
 * Chintan Waste Operations — write backend.
 *
 * The app reads the Sheet directly through the public CSV endpoint, but a
 * browser cannot write to a Sheet or to Drive on its own. Every write goes
 * through this Web App instead.
 *
 * Actions: append, appendMany, update, delete, upload, validate.
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

/** Rows deleted from any tab are archived here before the row is removed. */
var DELETED_TAB = 'Deleted_Items';

/**
 * Bumped whenever this file changes, so which version is actually deployed
 * can be checked by opening the /exec URL in a browser. Editing the code is
 * not enough: a deployment keeps serving a frozen snapshot until
 * Deploy > Manage deployments > edit > New version is run.
 */
var VERSION = '4 — master lists drive the Sheet dropdowns';

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);

    if (body.key !== API_KEY) {
      return respond({ ok: false, error: 'Rejected: the API key does not match.' });
    }

    /*
     * One writer at a time.
     *
     * Every write finds its row by number first and then acts on it. Two
     * requests overlapping could interleave between those steps, and a delete
     * shifts every row below it up by one — so without this, a concurrent
     * write could land on, or remove, the wrong record.
     */
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(25000)) {
      return respond({
        ok: false,
        error: 'The sheet is busy with another change. Please try again.'
      });
    }

    try {
      switch (body.action) {
        case 'append':     return respond(appendRow(body.tab, body.row));
        case 'appendMany': return respond(appendMany(body.tab, body.rows));
        case 'update':     return respond(updateRow(body.tab, body.idColumn, body.id, body.row));
        case 'delete':     return respond(deleteRow(body.tab, body.idColumn, body.id, body.context));
        case 'upload':     return respond(uploadFile(body.folder, body.name, body.mimeType, body.data));
        case 'validate':   return respond(setValidation(body.targets, body.values));
        default:           return respond({ ok: false, error: 'Unknown action: ' + body.action });
      }
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return respond({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

/** A GET is only ever a health check — it confirms the deployment is reachable. */
function doGet() {
  return respond({ ok: true, service: 'Chintan Waste write API', version: VERSION });
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
 * Removes the row from its tab, after writing a full copy to Deleted_Items.
 *
 * The row really does leave the sheet, so the tab only ever holds live
 * records. Nothing is lost: Record_Json in Deleted_Items holds every column
 * exactly as it was, which is what the Deleted Items screen restores from.
 */
function deleteRow(tabName, idColumn, id, context) {
  var sheet = sheetFor(tabName);
  var headers = headersOf(sheet);
  var rowNumber = findRowNumber(sheet, headers, idColumn, id);
  if (!rowNumber) throw new Error('No row in "' + tabName + '" has ' + idColumn + ' = ' + id + '.');

  var values = sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];

  var snapshot = {};
  headers.forEach(function (header, i) { snapshot[header] = values[i]; });

  var archive = archiveSheet();
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

  // Force the archive row out before destroying the original. Without this
  // both writes are still pending, and a failure here would take the record
  // with it.
  SpreadsheetApp.flush();

  sheet.deleteRow(rowNumber);
  SpreadsheetApp.flush();

  return { ok: true, rowNumber: rowNumber, removed: true, archived: true };
}

/**
 * The Deleted_Items tab, created with its header row if it is not there.
 *
 * A record is about to be destroyed, so the copy has to go somewhere. Making
 * the tab is better than refusing to delete, and far better than deleting
 * with nowhere to put the copy.
 */
function archiveSheet() {
  var book = SpreadsheetApp.getActiveSpreadsheet();
  var archive = book.getSheetByName(DELETED_TAB);
  if (archive) return archive;

  archive = book.insertSheet(DELETED_TAB);
  archive.appendRow([
    'Deletion_Id', 'Record_Type', 'Record_Ref_Id', 'Record_Label',
    'Record_Json', 'Cascade_Json',
    'Deleted_By', 'Deleted_On', 'Purge_On', 'Restored_By', 'Restored_On'
  ]);
  SpreadsheetApp.flush();
  return archive;
}

/* -------------------------------------------------------------------------- */
/*  Dropdowns in the Sheet itself                                             */
/* -------------------------------------------------------------------------- */

/**
 * Put a master list on a column as Google's own data-validation dropdown.
 *
 * `targets` is [{ tab: 'Vendors', column: 'Vendor_Type' }, ...] — the app
 * holds that mapping, in config/driveSchema.js. Invalid entries are allowed so
 * that a value removed from the list does not turn every record already
 * recorded against it into an error; Sheets marks those cells instead.
 *
 * A tab or column that does not exist is skipped rather than failing the whole
 * call, so one renamed tab cannot stop the rest of the lists being applied.
 */
function setValidation(targets, values) {
  var clean = (values || [])
    .map(function (v) { return String(v).trim(); })
    .filter(function (v) { return v !== ''; });

  if (!clean.length) throw new Error('A dropdown needs at least one value.');
  if (!targets || !targets.length) return { ok: true, applied: 0, skipped: [] };

  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(clean, true)
    .setAllowInvalid(true)
    .setHelpText('Set from Master Lists in the Waste Operations app.')
    .build();

  var book = SpreadsheetApp.getActiveSpreadsheet();
  var applied = [];
  var skipped = [];

  for (var i = 0; i < targets.length; i++) {
    var tabName = targets[i].tab;
    var columnName = targets[i].column;
    var sheet = book.getSheetByName(tabName);

    if (!sheet || sheet.getLastColumn() === 0) {
      skipped.push(tabName + '!' + columnName);
      continue;
    }

    var headers = headersOf(sheet);
    var column = headers.indexOf(columnName) + 1;
    if (!column) {
      skipped.push(tabName + '!' + columnName);
      continue;
    }

    // Everything below the header row, so rows added later are covered too.
    var height = Math.max(sheet.getMaxRows() - 1, 1);
    sheet.getRange(2, column, height, 1).setDataValidation(rule);
    applied.push(tabName + '!' + columnName);
  }

  SpreadsheetApp.flush();
  return { ok: true, applied: applied.length, columns: applied, skipped: skipped };
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

/**
 * `data` is the base64 body of the file, without the data: URL prefix.
 *
 * The file is made viewable by anyone with the link. The app has no Google
 * sign-in, so a file left private to this account cannot be shown in a
 * thumbnail or opened from a link in the app at all. Nothing uploaded here is
 * listed or searchable in Drive for anyone who does not already hold the id,
 * which is only in the Sheet.
 */
function uploadFile(folder, name, mimeType, data) {
  if (!data) throw new Error('No file content was received.');

  var bytes = Utilities.base64Decode(data);
  var blob = Utilities.newBlob(bytes, mimeType || 'application/octet-stream', name || 'upload');
  var file = subFolder(folder || 'Documents').createFile(blob);

  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (err) {
    // A Workspace domain can forbid link sharing. The upload itself stands;
    // the file is then only openable by people with access to the folder.
  }

  return { ok: true, fileId: file.getId() };
}

/**
 * Run once from the Apps Script editor (Run > shareExistingUploads).
 *
 * Files uploaded before the change above are still private to this account,
 * so the app cannot display them. This walks the uploads folder and gives
 * every file the same "anyone with the link — viewer" access. It is safe to
 * run again: setting the access a file already has does nothing.
 */
function shareExistingUploads() {
  var root = DriveApp.getFolderById(ROOT_FOLDER_ID);
  var shared = 0;
  var failed = 0;

  var share = function (files) {
    while (files.hasNext()) {
      var file = files.next();
      try {
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        shared += 1;
      } catch (err) {
        failed += 1;
        Logger.log('Could not share ' + file.getName() + ': ' + err);
      }
    }
  };

  share(root.getFiles());
  var folders = root.getFolders();
  while (folders.hasNext()) share(folders.next().getFiles());

  var summary = shared + ' file(s) shared, ' + failed + ' failed.';
  Logger.log(summary);
  return summary;
}
