/** Field validation rules from section 4.4 of the specification. */

export const PATTERNS = {
  pan: /^[A-Z]{5}[0-9]{4}[A-Z]$/,
  gstin: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/,
  ifsc: /^[A-Z]{4}0[A-Z0-9]{6}$/,
  mobile: /^[6-9]\d{9}$/,
  landline: /^0\d{2,4}[- ]?\d{6,8}$/,
  pin: /^\d{6}$/,
  account: /^\d{9,18}$/,
  vehicle: /^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{4}$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
};

export const required = (v) =>
  String(v ?? "").trim() === "" ? "This field is required" : "";

export const pan = (v) =>
  PATTERNS.pan.test(String(v).toUpperCase())
    ? ""
    : "Enter proper details – PAN format is AAAAA9999A";

/** GSTIN characters 3–12 must equal the PAN (section 4.4). */
export const gstin = (v, panValue = "") => {
  const g = String(v).toUpperCase();
  if (!PATTERNS.gstin.test(g)) return "Enter proper details – check the GST number";
  if (panValue && g.slice(2, 12) !== String(panValue).toUpperCase())
    return "Enter proper details – check the GST number";
  return "";
};

export const ifsc = (v) =>
  PATTERNS.ifsc.test(String(v).toUpperCase())
    ? ""
    : "IFSC must be 11 characters in the format AAAA0XXXXXX";

export const phone = (v) => {
  const s = String(v).replace(/[\s-]/g, "");
  return PATTERNS.mobile.test(s) || PATTERNS.landline.test(s)
    ? ""
    : "Enter a 10-digit mobile number, or a landline with its STD code";
};

export const email = (v) =>
  !v || PATTERNS.email.test(String(v)) ? "" : "Enter a valid email address";

export const pin = (v) => (PATTERNS.pin.test(String(v)) ? "" : "Pin code must be 6 digits");

export const accountNumber = (v) =>
  PATTERNS.account.test(String(v)) ? "" : "Account number must be 9 to 18 digits";

export const vehicleNumber = (v) =>
  PATTERNS.vehicle.test(String(v).replace(/[\s-]/g, "").toUpperCase())
    ? ""
    : "Enter an Indian registration number, for example DL01AB1234";

/** Weights: kg, up to 2 decimals, not negative. */
export const weight = (v) => {
  if (String(v).trim() === "") return "Enter a weight in kg";
  const n = Number(v);
  if (!Number.isFinite(n)) return "Enter a number";
  if (n < 0) return "Weight cannot be negative";
  if (!/^\d*(\.\d{1,2})?$/.test(String(v))) return "Up to 2 decimal places only";
  return "";
};

/** Collection and dispatch dates cannot be in the future. */
export const notFuture = (v) => {
  if (!v) return "Select a date";
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return new Date(v) > end ? "The date cannot be in the future" : "";
};

/** Run a { field: validatorFn } map over a values object. */
export function validate(values, rules) {
  const errors = {};
  for (const [field, rule] of Object.entries(rules)) {
    const message = rule(values[field], values);
    if (message) errors[field] = message;
  }
  return errors;
}
