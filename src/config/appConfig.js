/**
 * Branding and the few constants the code itself branches on.
 *
 * Deliberately almost empty: every dropdown list, threshold and factor lives in
 * the Settings tab of the Google Sheet and is read through SettingsContext, so
 * Chintan can change them without a code change (section 17.4).
 *
 * The keys below are structural — the permission logic compares against them —
 * so they are not configuration and stay here.
 */

const env = import.meta.env ?? {};

export const APP = {
  name: "Waste Operations Tracking System",
  org: "Chintan Environmental Research and Action Group",
  shortOrg: "Chintan",
  logoUrl:
    env.VITE_LOGO_URL ||
    "https://www.chintan-india.org/wp-content/uploads/2026/02/Chintan_Logo.jpg",
  specVersion: "v2.2 Final",
};

/** The two user types of section 3. Access control compares against these. */
export const ROLES = {
  SUPER_ADMIN: "Super Admin",
  SUPERVISOR: "Supervisor",
};

/**
 * Source-type keys. These are stored in the Sheet (Source_Type columns) and
 * matched in code, so the key is fixed; the label shown on screen comes from
 * here only because it is a translation of the key, not a configurable list.
 */
export const SOURCE_TYPE_LABEL = {
  MMRF: "MMRF / RRR Centres",
  RRR: "RRR on Wheels",
  BWG: "BWGs",
  SPECIAL: "Special collection",
};

/** Settings keys the application reads, so a typo is caught in one place. */
export const SETTING = {
  areas: "areas",
  wasteStreams: "wasteStreams",
  vendorTypes: "vendorTypes",
  bwgTypes: "bwgTypes",
  operationTypes: "operationTypes",
  collectionFrequencies: "collectionFrequencies",
  agreementTypes: "agreementTypes",
  mouTypes: "mouTypes",
  dispatchPurposes: "dispatchPurposes",
  financials: "financials",
  vehicleTypes: "vehicleTypes",
  sourceTypes: "sourceTypes",
  collectedByOptions: "collectedByOptions",
  states: "states",
  litreToKgFactor: "litreToKgFactor",
  maxUploadMb: "maxUploadMb",
  maxPhotoMb: "maxPhotoMb",
  supervisorBackdateDays: "supervisorBackdateDays",
  supervisorEditWindowDays: "supervisorEditWindowDays",
  documentExpiryWarnDays: "documentExpiryWarnDays",
  certificatePendingDays: "certificatePendingDays",
  deletedItemsRetentionDays: "deletedItemsRetentionDays",
};

/** Yes / No is a boolean, not a configurable list. */
export const YES_NO = ["Yes", "No"];
