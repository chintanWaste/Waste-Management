/**
 * Certificate calculations (specification section 15).
 *
 * Only categorised sources count: RRR on Wheels, BWG and Special collection.
 * MMRF dispatches are shown separately and are never tracked for certificates
 * (sections 14.2 and 15.1). Within those, only categories whose master row says
 * "Required" count towards a material group's certificate.
 */

import { parseDate } from "./format";

const CATEGORISED = new Set(["RRR", "BWG", "SPECIAL"]);

const num = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const live = (row) => String(row.Status || "Active").toLowerCase() !== "deleted";

const inRange = (value, from, to) => {
  const d = parseDate(value);
  if (!d) return false;
  if (from && d < parseDate(from)) return false;
  if (to && d > parseDate(to)) return false;
  return true;
};

/**
 * What has been dispatched to one vendor, split by material group.
 *
 * Returns {
 *   byGroup: { Plastic: { dispatched, required } },
 *   byStream: { Dry: kg },
 *   trackedTotal, mmrfTotal
 * }
 */
export function vendorDispatched({ vendorCode, dispatch, dispatchLines, from, to }) {
  const tracked = new Map();
  let mmrfTotal = 0;

  for (const row of dispatch) {
    if (!live(row) || row.Vendor_Code !== vendorCode) continue;
    if (from || to) {
      if (!inRange(row.Dispatch_Date, from, to)) continue;
    }
    if (row.Source_Type === "MMRF") {
      mmrfTotal += num(row.Total_Quantity_Kg);
      continue;
    }
    if (CATEGORISED.has(row.Source_Type)) tracked.set(row.Dispatch_Code, row);
  }

  const byGroup = {};
  const byStream = {};
  let trackedTotal = 0;

  for (const line of dispatchLines) {
    if (!tracked.has(line.Dispatch_Code)) continue;

    const kg = num(line.Quantity_Kg);
    const group = line.Material_Group || "Unspecified";
    const stream = line.Waste_Stream || "Unspecified";

    trackedTotal += kg;
    byStream[stream] = (byStream[stream] || 0) + kg;

    if (!byGroup[group]) byGroup[group] = { dispatched: 0, required: 0 };
    byGroup[group].dispatched += kg;

    // Only certificate-required categories count towards the certificate.
    if (line.Certificate_Requirement === "Required") byGroup[group].required += kg;
  }

  return { byGroup, byStream, trackedTotal, mmrfTotal };
}

/** Kg certified by a vendor, per material group. */
export function vendorCertified({ vendorCode, certificates }) {
  const byGroup = {};
  for (const row of certificates) {
    if (!live(row) || row.Vendor_Code !== vendorCode) continue;
    const group = row.Material_Group || "Unspecified";
    byGroup[group] = (byGroup[group] || 0) + num(row.Quantity_Certified_Kg);
  }
  return byGroup;
}

/**
 * The material-group table of section 15.1 — only groups that contain at least
 * one certificate-required category, counting only those categories.
 */
export function certificateRows({
  vendorCode, dispatch, dispatchLines, certificates, certificateGroups, from, to,
}) {
  const { byGroup } = vendorDispatched({ vendorCode, dispatch, dispatchLines, from, to });
  const certified = vendorCertified({ vendorCode, certificates });

  const groups = new Set([
    ...Object.keys(byGroup).filter((g) => byGroup[g].required > 0),
    ...Object.keys(certified),
  ]);

  return [...groups]
    .filter((group) => !certificateGroups?.length || certificateGroups.includes(group))
    .map((group) => {
      const dispatched = Number((byGroup[group]?.required || 0).toFixed(2));
      const done = Number((certified[group] || 0).toFixed(2));
      return {
        group,
        dispatched,
        certified: done,
        pending: Number(Math.max(0, dispatched - done).toFixed(2)),
      };
    })
    .sort((a, b) => b.pending - a.pending || a.group.localeCompare(b.group));
}

/** Quantity of one vendor certificate already used by diversion certificates. */
export function certificateUsage(certificateId, diversionCertificates) {
  return diversionCertificates
    .filter(
      (d) =>
        d.Vendor_Certificate_Id === certificateId &&
        String(d.Status || "Active").toLowerCase() !== "cancelled"
    )
    .reduce((sum, d) => sum + num(d.Quantity_Kg), 0);
}

/** Certificates with their used and remaining quantities worked out. */
export function certificatesWithRemaining(certificates, diversionCertificates) {
  return certificates.filter(live).map((row) => {
    const used = Number(certificateUsage(row.Certificate_Id, diversionCertificates).toFixed(2));
    const total = num(row.Quantity_Certified_Kg);
    return {
      ...row,
      used,
      remaining: Number(Math.max(0, total - used).toFixed(2)),
      total,
    };
  });
}

/**
 * Section 15.2 — vendor certificates a BWG's diversion certificate may draw on:
 * the right material group, from a vendor that BWG waste was dispatched to, and
 * with quantity left.
 */
export function eligibleCertificates({
  materialGroup, certificates, diversionCertificates, dispatch,
}) {
  const bwgVendors = new Set(
    dispatch
      .filter((d) => live(d) && d.Source_Type === "BWG" && d.Vendor_Code)
      .map((d) => d.Vendor_Code)
  );

  return certificatesWithRemaining(certificates, diversionCertificates)
    .filter((c) => c.Material_Group === materialGroup)
    .filter((c) => bwgVendors.has(c.Vendor_Code))
    .filter((c) => c.remaining > 0)
    .sort((a, b) => String(a.Certificate_Date).localeCompare(String(b.Certificate_Date)));
}

/** The purpose most used when dispatching BWG waste to a vendor. */
export function suggestedProcessingMethod({ vendorCode, dispatch }) {
  const counts = {};
  for (const row of dispatch) {
    if (!live(row) || row.Source_Type !== "BWG" || row.Vendor_Code !== vendorCode) continue;
    if (!row.Purpose) continue;
    counts[row.Purpose] = (counts[row.Purpose] || 0) + num(row.Total_Quantity_Kg);
  }
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return best ? best[0] : "";
}

/**
 * Section 15.2 — a warning, never a block: has this BWG been issued more
 * diversion certificates in the period than it actually gave us?
 */
export function overIssuedWarning({
  bwgCode, periodFrom, periodTo, quantity, diversionCertificates, inwardBwg,
}) {
  const collected = inwardBwg
    .filter((r) => live(r) && r.BWG_Code === bwgCode && inRange(r.Collection_Date, periodFrom, periodTo))
    .reduce((sum, r) => sum + num(r.Waste_Collected_Kg), 0);

  if (!collected) return "";

  const issued = diversionCertificates
    .filter(
      (d) =>
        d.BWG_Code === bwgCode &&
        String(d.Status || "Active").toLowerCase() !== "cancelled" &&
        inRange(d.Period_From, periodFrom, periodTo)
    )
    .reduce((sum, d) => sum + num(d.Quantity_Kg), 0);

  const total = issued + num(quantity);
  if (total <= collected) return "";

  return (
    `${bwgCode} collected ${collected.toFixed(2)} kg in this period but would have ` +
    `${total.toFixed(2)} kg of diversion certificates. Check the quantity before issuing.`
  );
}

/** Indian financial year label, e.g. "2026-27" — certificate numbers restart each year. */
export function financialYearOf(value) {
  const d = parseDate(value) || new Date();
  const start = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

/** CHN/DC/2026-27/0001, restarting each financial year (section 4.3). */
export function nextDiversionNumber({ certificateDate, existing, prefix = "CHN/DC" }) {
  const fy = financialYearOf(certificateDate);
  const head = `${prefix}/${fy}/`;

  let highest = 0;
  for (const row of existing) {
    const number = String(row.Diversion_Certificate_No || "");
    if (!number.startsWith(head)) continue;
    const serial = Number(number.slice(head.length));
    if (Number.isFinite(serial)) highest = Math.max(highest, serial);
  }

  return `${head}${String(highest + 1).padStart(4, "0")}`;
}
