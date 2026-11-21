/**
 * Named field rules, so every field is validated for what it actually holds
 * rather than only for being non-empty.
 *
 * Each builder returns (value, allValues) => "" | message, which is what
 * useForm expects. Messages name the field, so the user is told which one.
 */

import * as v from "./validators";
import { daysBetween, today } from "./format";

const trim = (value) => String(value ?? "").trim();

/* ------------------------------------------------------------------ text */

const PERSON = /^[A-Za-z][A-Za-z\s.'-]{1,}$/;
const ORG = /^[A-Za-z0-9][A-Za-z0-9\s&.,'()/-]{1,}$/;
const PLACE = /^[A-Za-z0-9][A-Za-z0-9\s&.,'()/-]{1,}$/;

/** A person's name: letters, spaces, full stops, apostrophes and hyphens. */
export const personName = (label, { required = true, max = 100 } = {}) => (value) => {
  const text = trim(value);
  if (!text) return required ? `${label} is required` : "";
  if (text.length < 2) return `${label} is too short`;
  if (text.length > max) return `${label} must be ${max} characters or fewer`;
  if (/\d/.test(text)) return `${label} should not contain numbers`;
  if (!PERSON.test(text)) return `${label} contains characters that are not allowed`;
  return "";
};

/**
 * An organisation or firm name.
 *
 * Digits are allowed, because real firm names use them (3M, 24x7 Recyclers),
 * but the value must read as a name: at least two letters, and not mostly
 * digits. So "Green Cycle 24" passes and "123456" does not.
 */
export const orgName = (label, { required = true, max = 150 } = {}) => (value) => {
  const text = trim(value);
  if (!text) return required ? `${label} is required` : "";
  if (text.length < 2) return `${label} is too short`;
  if (text.length > max) return `${label} must be ${max} characters or fewer`;
  if (!ORG.test(text)) return `${label} contains characters that are not allowed`;

  const letters = (text.match(/[A-Za-z]/g) || []).length;
  const digits = (text.match(/d/g) || []).length;
  if (letters < 2) return `${label} must be a name, not a number`;
  if (digits > letters) return `${label} has more digits than letters — check it`;
  return "";
};

/** A place: city, district, branch, location, ward. */
export const placeName = (label, { required = true, max = 100 } = {}) => (value) => {
  const text = trim(value);
  if (!text) return required ? `${label} is required` : "";
  if (text.length < 2) return `${label} is too short`;
  if (text.length > max) return `${label} must be ${max} characters or fewer`;
  if (!PLACE.test(text)) return `${label} contains characters that are not allowed`;
  if (!/[A-Za-z]{2}/.test(text)) return `${label} must contain letters`;
  return "";
};

/** A postal address — freer, but still a real address rather than one word. */
export const address = (label, { required = true, min = 8, max = 300 } = {}) => (value) => {
  const text = trim(value);
  if (!text) return required ? `${label} is required` : "";
  if (text.length < min) return `${label} looks too short — include the street and locality`;
  if (text.length > max) return `${label} must be ${max} characters or fewer`;
  return "";
};

/** A code, reference or certificate number. */
export const reference = (label, { required = true, max = 40 } = {}) => (value) => {
  const text = trim(value);
  if (!text) return required ? `${label} is required` : "";
  if (text.length > max) return `${label} must be ${max} characters or fewer`;
  if (!/^[A-Za-z0-9][A-Za-z0-9\s/._-]*$/.test(text)) {
    return `${label} may use letters, digits and - / . _ only`;
  }
  return "";
};

/** A choice from a dropdown; `options` makes a tampered value fail too. */
export const choice = (label, options) => (value) => {
  const text = trim(value);
  if (!text) return `${label} is required`;
  if (options?.length && !options.includes(text)) return `Choose a valid ${label.toLowerCase()}`;
  return "";
};

/** Free text with no pattern, e.g. a reason or remark. */
export const notes = (label, { required = true, min = 3, max = 500 } = {}) => (value) => {
  const text = trim(value);
  if (!text) return required ? `${label} is required` : "";
  if (text.length < min) return `${label} is too short`;
  if (text.length > max) return `${label} must be ${max} characters or fewer`;
  return "";
};

/* --------------------------------------------------------------- numbers */

/** A weight in kg: not negative, up to 2 decimals, and within a sane ceiling. */
export const weightKg = (label, { required = true, max = 1000000 } = {}) => (value) => {
  if (trim(value) === "") return required ? `${label} is required` : "";
  const error = v.weight(value);
  if (error) return error;
  if (Number(value) > max) return `${label} looks too large — check the figure`;
  return "";
};

/** A whole number, e.g. number of workers. */
export const wholeNumber = (label, { required = true, min = 0, max = 100000 } = {}) => (value) => {
  if (trim(value) === "") return required ? `${label} is required` : "";
  if (!/^\d+$/.test(trim(value))) return `${label} must be a whole number`;
  const n = Number(value);
  if (n < min) return `${label} cannot be less than ${min}`;
  if (n > max) return `${label} looks too large — check the figure`;
  return "";
};

/** A positive quantity, e.g. capacity in kg per day. */
export const capacity = (label, { required = true, max = 1000000 } = {}) => (value) => {
  if (trim(value) === "") return required ? `${label} is required` : "";
  const n = Number(value);
  if (!Number.isFinite(n)) return `${label} must be a number`;
  if (n <= 0) return `${label} must be more than zero`;
  if (n > max) return `${label} looks too large — check the figure`;
  return "";
};

/* ----------------------------------------------------------------- dates */

/** A date that cannot be in the future, e.g. a collection or dispatch date. */
export const pastDate = (label, { required = true, withinDays } = {}) => (value) => {
  if (!value) return required ? `${label} is required` : "";
  const ahead = daysBetween(today(), value);
  if (ahead === null) return `${label} is not a valid date`;
  if (ahead > 0) return `${label} cannot be in the future`;
  if (withinDays && daysBetween(value, today()) > withinDays) {
    return `${label} can be at most ${withinDays} days back`;
  }
  return "";
};

/** A date that must be in the future, e.g. a document validity date. */
export const futureDate = (label, { required = true } = {}) => (value) => {
  if (!value) return required ? `${label} is required` : "";
  const ahead = daysBetween(today(), value);
  if (ahead === null) return `${label} is not a valid date`;
  if (ahead < 0) return `${label} has already passed — renew the document first`;
  return "";
};

/** Any valid date, with an optional "not before" field. */
export const dateField = (label, { required = true, notBefore, notBeforeLabel } = {}) =>
  (value, all) => {
    if (!value) return required ? `${label} is required` : "";
    if (notBefore && all?.[notBefore] && value < all[notBefore]) {
      return `${label} cannot be before the ${notBeforeLabel || notBefore.replace(/_/g, " ").toLowerCase()}`;
    }
    return "";
  };

/* ------------------------------------------------- identity and contacts */

export const phone = (label = "Phone Number", { required = true } = {}) => (value) => {
  if (trim(value) === "") return required ? `${label} is required` : "";
  return v.phone(value);
};

export const email = (label = "Email Address", { required = true } = {}) => (value) => {
  if (trim(value) === "") return required ? `${label} is required` : "";
  return v.email(value);
};

export const pinCode = (label = "Pin Code", { required = true } = {}) => (value) => {
  if (trim(value) === "") return required ? `${label} is required` : "";
  return v.pin(value);
};

export const pan = (label = "PAN Number", { required = true } = {}) => (value) => {
  if (trim(value) === "") return required ? `${label} is required` : "";
  return v.pan(value);
};

export const gstin = (panField = "PAN_Number", { required = true } = {}) => (value, all) => {
  if (trim(value) === "") return required ? "GST number is required" : "";
  return v.gstin(value, all?.[panField]);
};

export const ifsc = (label = "IFSC Code", { required = true } = {}) => (value) => {
  if (trim(value) === "") return required ? `${label} is required` : "";
  return v.ifsc(value);
};

export const accountNumber = (label = "Account Number", { required = true } = {}) => (value) => {
  if (trim(value) === "") return required ? `${label} is required` : "";
  return v.accountNumber(value);
};

export const confirmMatch = (otherField, label, otherLabel) => (value, all) => {
  if (trim(value) === "") return `${label} is required`;
  return value !== all?.[otherField] ? `${label} does not match the ${otherLabel}` : "";
};

export const vehicleNumber = (label = "Registration Number", { required = true } = {}) => (value) => {
  if (trim(value) === "") return required ? `${label} is required` : "";
  return v.vehicleNumber(value);
};

/** A driving licence: 2 letters, then digits, 9–20 characters overall. */
export const licenceNumber = (label = "Driving Licence Number", { required = true } = {}) => (value) => {
  const text = trim(value).replace(/[\s-]/g, "").toUpperCase();
  if (!text) return required ? `${label} is required` : "";
  if (text.length < 9 || text.length > 20) return `${label} must be 9 to 20 characters`;
  if (!/^[A-Z]{2}[A-Z0-9]+$/.test(text)) {
    return `${label} should start with the two-letter state code, e.g. DL0320110012345`;
  }
  return "";
};

/** An engine or chassis number: alphanumeric, no punctuation. */
export const machineNumber = (label, { required = true, min = 5, max = 25 } = {}) => (value) => {
  const text = trim(value).toUpperCase();
  if (!text) return required ? `${label} is required` : "";
  if (!/^[A-Z0-9]+$/.test(text)) return `${label} may contain letters and digits only`;
  if (text.length < min) return `${label} must be at least ${min} characters`;
  if (text.length > max) return `${label} must be ${max} characters or fewer`;
  return "";
};

/* ---------------------------------------------------------------- files */

export const requiredFile = (label, file) => () =>
  file ? "" : `${label} is required`;

export const requiredPhotos = (label, photos, { min = 1 } = {}) => () =>
  (photos?.length || 0) >= min ? "" : `At least ${min} ${label.toLowerCase()} is required`;

/** Only when the condition is true does the inner rule apply. */
export const when = (condition, rule) => (value, all) =>
  condition(all) ? rule(value, all) : "";
