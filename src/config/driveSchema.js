/**
 * ============================================================================
 *  THE ONE FILE TO EDIT WHEN THE GOOGLE SHEET CHANGES
 * ============================================================================
 *
 * Everything about the Google Drive connection and the Sheet's columns lives
 * here. To add a column: add it to the tab's `columns` list below (and, for
 * Vendors, to VENDOR_FIELDS). Nothing else in the application needs changing —
 * the form, the directory, the Excel template and the Apps Script set-up all
 * read this file.
 *
 * How the data flows:
 *   Google Drive folder ──┬── Chintan_Waste_Data (Sheet)  → every table, one tab each
 *                         ├── /Documents                  → onboarding PDFs, certificates
 *                         └── /Photos                     → inward entry photos
 *
 * READ  → public gviz CSV endpoint (needs "Anyone with the link · Viewer").
 * WRITE → Apps Script Web App deployed on the Sheet (see apps-script/).
 */

// `?? {}` keeps this file importable by the Node tooling in docs/tools/,
// where Vite's import.meta.env does not exist.
const env = import.meta.env ?? {};

/* ========================================================================== */
/*  1. CONNECTION                                                             */
/* ========================================================================== */

export const DRIVE = {
  /** The id in https://docs.google.com/spreadsheets/d/<SHEET_ID>/edit */
  sheetId: env.VITE_SHEET_ID || "",

  /** The id in https://drive.google.com/drive/folders/<FOLDER_ID> */
  rootFolderId: env.VITE_DRIVE_FOLDER_ID || "",

  /** Deployed Apps Script Web App URL (…/exec) used for all writes. */
  apiUrl: env.VITE_SHEET_API_URL || "",

  /** Shared secret sent with every write, checked by the Apps Script. */
  apiKey: env.VITE_SHEET_API_KEY || "",

  /** Minutes a fetched tab is reused before it is fetched again. */
  cacheMinutes: Number(env.VITE_CACHE_MINUTES || 5),
};

export const isDriveConfigured = () => Boolean(DRIVE.sheetId);

/** True once a write URL of any kind has been configured. */
export const isWriteConfigured = () => Boolean(DRIVE.apiUrl);

/**
 * A deployed Apps Script Web App. Two shapes are valid:
 *   https://script.google.com/macros/s/<deploymentId>/exec
 *   https://script.google.com/a/macros/<domain>/s/<deploymentId>/exec  (Workspace)
 */
const WEB_APP_URL =
  /^https:\/\/script\.google\.com\/(a\/macros\/[^/]+|macros)\/s\/[^/]+\/exec$/;

/**
 * Why a write URL cannot be used, or "" if it looks right.
 *
 * Posting to anything other than a deployed Web App fails as a CORS error,
 * because whatever answers is ordinary Google HTML with no
 * Access-Control-Allow-Origin header. The browser reports that as a bare
 * "Failed to fetch", which says nothing about the real mistake, so the shape
 * of the URL is checked here instead and the problem named precisely.
 *
 * Kept separate from DRIVE so it can be exercised without a Vite environment.
 */
export function describeWriteUrl(url) {
  if (!url) return "";
  if (WEB_APP_URL.test(url)) return "";

  // By far the most common mix-up: the address bar of the Apps Script editor.
  if (/script\.google\.com\/.*(projects|\/edit)/.test(url)) {
    return (
      "VITE_SHEET_API_URL is the Apps Script editor page, not the deployed Web App. " +
      "The editor URL carries the script id; the Web App URL carries a different " +
      "deployment id and ends in /exec. In the Apps Script editor use " +
      "Deploy > New deployment > Web app — or Deploy > Manage deployments if one " +
      "already exists — and copy the Web app URL."
    );
  }

  if (/docs\.google\.com/.test(url)) {
    return (
      "VITE_SHEET_API_URL is the spreadsheet's own address, not the Apps Script Web App. " +
      "It should look like https://script.google.com/macros/s/<id>/exec."
    );
  }

  return (
    "VITE_SHEET_API_URL does not look like a deployed Apps Script Web App. " +
    `It should look like https://script.google.com/macros/s/<id>/exec, not "${url}".`
  );
}

/** Why the configured write URL cannot be used, or "" if it looks right. */
export const writeUrlProblem = () => describeWriteUrl(DRIVE.apiUrl);

/** Read a whole tab as CSV through the gviz endpoint. */
export const sheetCsvUrl = (tabName) =>
  `https://docs.google.com/spreadsheets/d/${DRIVE.sheetId}/gviz/tq` +
  `?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;

/* ========================================================================== */
/*  2. TAB COLUMNS                                                            */
/*                                                                            */
/*  `tab` is the exact tab name in the Sheet. `columns` is the header row,     */
/*  in order. A column ending _File_Id holds a Drive FILE ID (never a URL);    */
/*  _File_Ids holds several ids separated by "|".                             */
/* ========================================================================== */

const AUDIT = ["Created_By", "Created_On", "Updated_By", "Updated_On"];
const ENTRY_AUDIT = [...AUDIT, "Approval_Status"];

export const TABS = {
  /* ---- masters & onboarding ---- */

  users: {
    tab: "Users", idColumn: "User_Id",
    columns: [
      "User_Id", "Full_Name", "Username", "Password_Hash", "Role",
      "Assigned_Source_Types", "Assigned_Areas", "Phone", "Email",
      "Must_Change_Password", "Status", "Last_Login", "Created_By", "Created_On",
    ],
  },

  vendors: {
    tab: "Vendors", idColumn: "Vendor_Code",
    columns: [
      "Vendor_Code", "Vendor_Name", "Vendor_Type", "Vendor_Type_Other",
      "Address", "City_District", "State", "Pin_Code",
      "Contact_Person", "Phone", "Email",
      "PAN_Number", "GST_Registered", "GST_Number",
      "Onboarding_Date", "MoU_Type", "MoU_End_Date",
      "Bank_Account_Name", "Bank_Name", "Account_Number", "Branch_Name", "IFSC_Code",
      "Documents_File_Id", "Status", ...AUDIT,
    ],
  },

  bwgs: {
    tab: "BWGs", idColumn: "BWG_Code",
    columns: [
      "BWG_Code", "BWG_Name", "BWG_Type", "BWG_Type_Other", "Area",
      "Operation_Type", "Onboarding_Date", "Address", "Pin_Code", "Ward_Zone",
      "Contact_Person", "Phone", "Email", "Collection_Frequency",
      "GST_Registered", "GST_Number", "PAN_Number", "PAN_Not_Available",
      "Agreement_Type", "Bank_Account_Name", "Bank_Name", "Account_Number",
      "IFSC_Code", "Branch_Name", "Bank_Address",
      "Documents_File_Id", "Status", ...AUDIT,
    ],
  },

  mmrfs: {
    tab: "MMRFs", idColumn: "MMRF_Code",
    columns: [
      "MMRF_Code", "MMRF_Name", "Location", "Area", "Operation_Type",
      "Complete_Address", "In_Charge_Name", "Contact_Number", "Email",
      "Capacity_Kg_Per_Day", "Number_Of_Workers", "Supervised_By",
      "MoU_File_Id", "Status", ...AUDIT,
    ],
  },

  vehicles: {
    tab: "Vehicles", idColumn: "Vehicle_Code",
    columns: [
      "Vehicle_Code", "Registration_Number", "Engine_Number", "Chassis_Number",
      "Vehicle_Type", "Vehicle_Model", "Insurance_Validity_Date", "PUC_Validity_Date",
      "Fitness_Validity_Date", "Registration_Validity_Date",
      "Documents_File_Id", "Status", ...AUDIT,
    ],
  },

  drivers: {
    tab: "Drivers", idColumn: "Driver_Code",
    columns: [
      "Driver_Code", "Driver_Name", "Licence_Number", "Contact_Number",
      "Licence_Validity_Date", "Licence_File_Id", "Status", ...AUDIT,
    ],
  },

  /** Dated allocation history — one row per BWG per allocation period. */
  linkage: {
    tab: "BWG_Vendor_Linkage", idColumn: "Linkage_Id",
    columns: [
      "Linkage_Id", "BWG_Code", "Vendor_Code",
      "Linked_From_Date", "Linked_To_Date", "Is_Current", "Created_By", "Created_On",
    ],
  },

  /** The 60-row category master from Annex B. */
  wasteCategories: {
    tab: "Waste_Categories", idColumn: "Category_Id",
    columns: [
      "Category_Id", "Serial_No", "Waste_Stream", "Material_Group",
      "Waste_Category", "Unit", "Certificate_Requirement", "Sort_Order", "Status",
      "Created_On", "Updated_On",
    ],
  },

  settings: {
    tab: "Settings", idColumn: "Setting_Key",
    columns: ["Setting_Key", "Setting_Value", "Description", "Updated_By", "Updated_On"],
  },

  /* ---- inward entry ---- */

  inwardMmrf: {
    tab: "Inward_MMRF", idColumn: "Entry_Id",
    columns: [
      "Entry_Id", "Collection_Date", "Area", "MMRF_Code", "Waste_Collected_Kg",
      "Batch_Id", "Status", ...ENTRY_AUDIT,
    ],
  },

  inwardRrr: {
    tab: "Inward_RRR", idColumn: "Entry_Id",
    columns: [
      "Entry_Id", "Collection_Date", "Vehicle_Code", "Driver_Code", "Area",
      "Total_Waste_Collected_Kg", "Photo_File_Ids", "Categorisation_Status",
      "Status", ...ENTRY_AUDIT,
    ],
  },

  inwardBwg: {
    tab: "Inward_BWG", idColumn: "Entry_Id",
    columns: [
      "Entry_Id", "Batch_Id", "Collection_Date", "Area",
      "BWG_Code", "Vendor_Code", "Waste_Collected_Kg",
      "Photo_File_Id", "Status", ...ENTRY_AUDIT,
    ],
  },

  bwgCharacterisation: {
    tab: "BWG_Characterisation", idColumn: "Characterisation_Id",
    columns: [
      "Characterisation_Id", "Collection_Date", "Vendor_Code",
      "Total_Collected_Kg", "Number_Of_BWGs", "Characterisation_Status",
      "Status", ...ENTRY_AUDIT,
    ],
  },

  inwardSpecial: {
    tab: "Inward_Special", idColumn: "Entry_Code",
    columns: [
      "Entry_Code", "Collection_Date", "Location", "Area",
      "Contact_Person", "Phone", "Email",
      "Collected_By", "Vendor_Code", "Vehicle_Code", "Driver_Code",
      "Total_Waste_Collected_Kg", "Photo_File_Ids", "Categorisation_Status",
      "Status", ...ENTRY_AUDIT,
    ],
  },

  /**
   * The category break-up for RRR entries, Special collection entries and BWG
   * characterisations — one row per category, so the 60-category master can
   * change without reshaping any tab.
   */
  entryCategories: {
    tab: "Entry_Categories", idColumn: "Line_Id",
    columns: [
      "Line_Id", "Source_Type", "Entry_Ref_Id", "Collection_Date",
      "Category_Id", "Waste_Category", "Material_Group", "Waste_Stream",
      "Quantity_Entered", "Unit", "Quantity_Kg", "Created_By", "Created_On",
    ],
  },

  /* ---- dispatch & certificates ---- */

  dispatch: {
    tab: "Dispatch", idColumn: "Dispatch_Code",
    columns: [
      "Dispatch_Code", "Dispatch_Date", "Source_Type", "Source_Ref",
      "Area", "Vendor_Code", "Purpose", "Financials",
      "Total_Quantity_Kg", "Status", ...ENTRY_AUDIT,
    ],
  },

  dispatchLines: {
    tab: "Dispatch_Lines", idColumn: "Line_Id",
    columns: [
      "Line_Id", "Dispatch_Code", "Category_Id", "Waste_Category",
      "Material_Group", "Waste_Stream", "Quantity_Kg",
      "Certificate_Requirement", "Created_On",
    ],
  },

  vendorCertificates: {
    tab: "Vendor_Certificates", idColumn: "Certificate_Id",
    columns: [
      "Certificate_Id", "Vendor_Code", "Certificate_Number", "Certificate_Date",
      "Material_Group", "Quantity_Certified_Kg", "Quantity_Used_Kg",
      "Quantity_Remaining_Kg", "Certificate_File_Id", "Status", ...AUDIT,
    ],
  },

  diversionCertificates: {
    tab: "Diversion_Certificates", idColumn: "Diversion_Certificate_No",
    columns: [
      "Diversion_Certificate_No", "Certificate_Date", "BWG_Code", "Material_Group",
      "Vendor_Certificate_Id", "Vendor_Certificate_Number", "Vendor_Code",
      "Quantity_Kg", "Processing_Method", "Period_From", "Period_To",
      "PDF_File_Id", "Status", "Cancelled_Reason", "Cancelled_By", "Cancelled_On",
      "Created_By", "Created_On",
    ],
  },

  /* ---- administration ---- */

  approvals: {
    tab: "Approvals", idColumn: "Approval_Id",
    columns: [
      "Approval_Id", "Record_Type", "Record_Ref_Id", "Change_Type",
      "Old_Values_Json", "New_Values_Json", "Requested_By", "Requested_On",
      "Decision", "Decision_Remark", "Decided_By", "Decided_On",
    ],
  },

  alerts: {
    tab: "Alerts", idColumn: "Alert_Id",
    columns: [
      "Alert_Id", "Alert_Type", "Severity", "Title", "Message",
      "Related_Record_Type", "Related_Record_Id", "Area", "Source_Type",
      "Raised_On", "Status", "Closed_By", "Closed_On",
    ],
  },

  deletedItems: {
    tab: "Deleted_Items", idColumn: "Deletion_Id",
    columns: [
      "Deletion_Id", "Record_Type", "Record_Ref_Id", "Record_Label",
      "Record_Json", "Cascade_Json",
      "Deleted_By", "Deleted_On", "Purge_On", "Restored_By", "Restored_On",
    ],
  },

  auditLog: {
    tab: "Audit_Log", idColumn: "Log_Id",
    columns: [
      "Log_Id", "Timestamp", "User_Id", "User_Name", "Action",
      "Record_Type", "Record_Ref_Id", "Field_Changed",
      "Old_Value", "New_Value", "Remark",
    ],
  },
};

/* ========================================================================== */
/*  3. LOOKUPS                                                                */
/* ========================================================================== */

export const ALL_TABS = Object.values(TABS);

/** Lookup by the Google Sheet tab name. */
export const TAB_BY_NAME = Object.fromEntries(ALL_TABS.map((t) => [t.tab, t]));

export const isFileColumn = (col) => /_File_Ids?$/.test(col);

/* ========================================================================== */
/*  4. NAMED EXPORTS used across the application                              */
/* ========================================================================== */

export const {
  users: USERS, vendors: VENDORS, bwgs: BWGS, mmrfs: MMRFS,
  vehicles: VEHICLES, drivers: DRIVERS, linkage: LINKAGE,
  wasteCategories: WASTE_CATEGORIES, settings: SETTINGS,
  inwardMmrf: INWARD_MMRF, inwardRrr: INWARD_RRR, inwardBwg: INWARD_BWG,
  bwgCharacterisation: BWG_CHARACTERISATION, inwardSpecial: INWARD_SPECIAL,
  entryCategories: ENTRY_CATEGORIES, dispatch: DISPATCH, dispatchLines: DISPATCH_LINES,
  vendorCertificates: VENDOR_CERTIFICATES, diversionCertificates: DIVERSION_CERTIFICATES,
  approvals: APPROVALS, alerts: ALERTS, deletedItems: DELETED_ITEMS, auditLog: AUDIT_LOG,
} = TABS;
