/**
 * Document expiry, shared by the vehicle and driver inventories, the inward
 * entry dropdowns and the dashboard alerts (sections 6.4, 10.3).
 *
 * Red once expired, amber within the warning window, otherwise plain.
 */

import { daysBetween, parseDate, today } from "./format";

export const EXPIRY_STATE = { EXPIRED: "expired", SOON: "soon", OK: "ok", NONE: "none" };

export function expiryState(value, warnDays = 30, asOf = today()) {
  if (!value) return EXPIRY_STATE.NONE;
  const days = daysBetween(asOf, value);
  if (days === null) return EXPIRY_STATE.NONE;
  if (days < 0) return EXPIRY_STATE.EXPIRED;
  if (days <= warnDays) return EXPIRY_STATE.SOON;
  return EXPIRY_STATE.OK;
}

export const TONE_FOR_STATE = {
  [EXPIRY_STATE.EXPIRED]: "danger",
  [EXPIRY_STATE.SOON]: "warn",
  [EXPIRY_STATE.OK]: "muted",
  [EXPIRY_STATE.NONE]: "muted",
};

/** The documents each vehicle type must hold valid (section 10.1). */
export function vehicleDocuments(vehicle) {
  const docs = [
    ["Insurance", vehicle.Insurance_Validity_Date],
    ["Fitness", vehicle.Fitness_Validity_Date],
    ["Registration", vehicle.Registration_Validity_Date],
  ];
  // PUC is shown as "Not applicable" for an electric vehicle.
  if (vehicle.Vehicle_Type !== "Electric") docs.push(["PUC", vehicle.PUC_Validity_Date]);
  return docs;
}

/**
 * Section 10.3 — a vehicle whose insurance, PUC, fitness or registration has
 * expired on the collection date cannot be selected in any inward entry.
 * Returns "" when it may be used, or the message to show.
 */
export function vehicleBlockedOn(vehicle, onDate) {
  for (const [label, validTo] of vehicleDocuments(vehicle)) {
    if (!validTo) return `${label} date is missing for ${vehicle.Registration_Number}.`;
    if (parseDate(validTo) < parseDate(onDate)) {
      return (
        `${label} of ${vehicle.Registration_Number} expired on ` +
        `${String(validTo).split("-").reverse().join("-")}. ` +
        `Renew the document in Vehicles, or choose another vehicle.`
      );
    }
  }
  return "";
}

/** The same rule for a driver's licence. */
export function driverBlockedOn(driver, onDate) {
  const validTo = driver.Licence_Validity_Date;
  if (!validTo) return `Licence validity date is missing for ${driver.Driver_Name}.`;
  if (parseDate(validTo) < parseDate(onDate)) {
    return (
      `Driving licence of ${driver.Driver_Name} expired on ` +
      `${String(validTo).split("-").reverse().join("-")}. ` +
      `Renew it in Drivers, or choose another driver.`
    );
  }
  return "";
}

/** Vehicles selectable on a date: active, with every document valid. */
export const usableVehicles = (vehicles, onDate) =>
  vehicles.filter(
    (v) =>
      String(v.Status || "Active").toLowerCase() === "active" &&
      !vehicleBlockedOn(v, onDate)
  );

export const usableDrivers = (drivers, onDate) =>
  drivers.filter(
    (d) =>
      String(d.Status || "Active").toLowerCase() === "active" &&
      !driverBlockedOn(d, onDate)
  );
