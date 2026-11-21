/**
 * Report builders (specification section 16).
 *
 * Each builder takes the Sheet data plus the chosen filters and returns
 * { title, meta, sections }, where a section is a named table. The screen shows
 * those sections and the same structure is handed to the PDF and Excel writers,
 * so what you see is exactly what downloads.
 *
 * A BWG-wise report is deliberately absent — Chintan prepares those by hand
 * (section 16).
 */

import { num } from "./format";
import { inPeriod } from "./period";
import {
  categoryStock, groupStock, mmrfStock,
} from "./stock";
import { certificateRows, certificatesWithRemaining } from "./certificates";

const n = (value) => {
  const x = Number(value);
  return Number.isFinite(x) ? x : 0;
};

const live = (row) => String(row.Status || "Active").toLowerCase() !== "deleted";

const kg2 = (value) => Number(n(value).toFixed(2));

/** Sum a column, grouped by another column. */
function groupSum(rows, keyColumn, valueColumn) {
  const out = new Map();
  for (const row of rows) {
    const key = row[keyColumn] || "Unspecified";
    out.set(key, (out.get(key) || 0) + n(row[valueColumn]));
  }
  return [...out.entries()].sort((a, b) => b[1] - a[1]);
}

const nameMap = (rows, codeColumn, nameColumn) =>
  Object.fromEntries(rows.map((r) => [r[codeColumn], r[nameColumn]]));

/* ------------------------------------------------------- 16  MMRF report */

export function mmrfReport({ data, range, area, mmrfCode }) {
  const names = nameMap(data.mmrfs, "MMRF_Code", "MMRF_Name");
  const capacity = Object.fromEntries(
    data.mmrfs.map((m) => [m.MMRF_Code, n(m.Capacity_Kg_Per_Day)])
  );

  const inward = data.inwardMmrf.filter(
    (r) =>
      live(r) &&
      inPeriod(r.Collection_Date, range) &&
      (!area || r.Area === area) &&
      (!mmrfCode || r.MMRF_Code === mmrfCode)
  );

  const dispatches = data.dispatch.filter(
    (d) =>
      live(d) && d.Source_Type === "MMRF" &&
      inPeriod(d.Dispatch_Date, range) &&
      (!mmrfCode || d.Source_Ref === mmrfCode)
  );

  const days = new Set(inward.map((r) => r.Collection_Date)).size || 1;

  const perCentre = groupSum(inward, "MMRF_Code", "Waste_Collected_Kg").map(([code, total]) => {
    const perDay = total / days;
    const cap = capacity[code] || 0;
    return {
      Centre: `${code} — ${names[code] || ""}`,
      Collected_Kg: kg2(total),
      Average_Per_Day: kg2(perDay),
      Capacity_Kg_Per_Day: cap || "—",
      Capacity_Use: cap ? `${num((perDay / cap) * 100, 1)}%` : "—",
    };
  });

  const daily = groupSum(inward, "Collection_Date", "Waste_Collected_Kg")
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
    .map(([day, total]) => ({ Date: day, Collected_Kg: kg2(total) }));

  const byVendor = groupSum(dispatches, "Vendor_Code", "Total_Quantity_Kg").map(([code, total]) => ({
    Vendor: code,
    Dispatched_Kg: kg2(total),
  }));

  const byPurpose = groupSum(dispatches, "Purpose", "Total_Quantity_Kg").map(([purpose, total]) => ({
    Purpose: purpose,
    Dispatched_Kg: kg2(total),
  }));

  const stock = mmrfStock({
    inwardMmrf: data.inwardMmrf, dispatch: data.dispatch,
    from: range.from, to: range.to,
  })
    .filter((s) => !mmrfCode || s.code === mmrfCode)
    .map((s) => ({
      Centre: `${s.code} — ${names[s.code] || ""}`,
      Opening_Kg: kg2(s.opening), Collected_Kg: kg2(s.collected),
      Dispatched_Kg: kg2(s.dispatched), Closing_Kg: kg2(s.closing),
    }));

  return {
    title: "MMRF / RRR Centre report",
    sections: [
      { name: "Collection by centre", rows: perCentre },
      { name: "Daily trend", rows: daily },
      { name: "Dispatches by vendor", rows: byVendor },
      { name: "Dispatches by purpose", rows: byPurpose },
      { name: "Stock", rows: stock },
    ],
  };
}

/* ----------------------------------------------- 16  RRR on Wheels report */

export function rrrReport({ data, range, area, vehicleCode, driverCode }) {
  const vehicles = nameMap(data.vehicles, "Vehicle_Code", "Registration_Number");
  const drivers = nameMap(data.drivers, "Driver_Code", "Driver_Name");

  const entries = data.inwardRrr.filter(
    (r) =>
      live(r) && inPeriod(r.Collection_Date, range) &&
      (!area || r.Area === area) &&
      (!vehicleCode || r.Vehicle_Code === vehicleCode) &&
      (!driverCode || r.Driver_Code === driverCode)
  );

  const ids = new Set(entries.map((r) => r.Entry_Id));
  const lines = data.entryCategories.filter(
    (l) => l.Source_Type === "RRR" && ids.has(l.Entry_Ref_Id)
  );

  const byVehicle = groupSum(entries, "Vehicle_Code", "Total_Waste_Collected_Kg").map(([code, total]) => ({
    Vehicle: `${code} — ${vehicles[code] || ""}`,
    Collected_Kg: kg2(total),
    Entries: entries.filter((e) => e.Vehicle_Code === code).length,
  }));

  const byDriver = groupSum(entries, "Driver_Code", "Total_Waste_Collected_Kg").map(([code, total]) => ({
    Driver: `${code} — ${drivers[code] || ""}`,
    Collected_Kg: kg2(total),
    Entries: entries.filter((e) => e.Driver_Code === code).length,
  }));

  const byCategory = groupSum(lines, "Waste_Category", "Quantity_Kg").map(([name, total]) => ({
    Category: name, Quantity_Kg: kg2(total),
  }));

  const dispatches = data.dispatch.filter(
    (d) => live(d) && d.Source_Type === "RRR" && inPeriod(d.Dispatch_Date, range)
  );
  const byVendor = groupSum(dispatches, "Vendor_Code", "Total_Quantity_Kg").map(([code, total]) => ({
    Vendor: code, Dispatched_Kg: kg2(total),
  }));

  const entryRows = entries
    .sort((a, b) => String(a.Collection_Date).localeCompare(String(b.Collection_Date)))
    .map((e) => ({
      Date: e.Collection_Date,
      Vehicle: e.Vehicle_Code,
      Driver: e.Driver_Code,
      Area: e.Area,
      Collected_Kg: kg2(e.Total_Waste_Collected_Kg),
      Categorised: e.Categorisation_Status || "Pending",
    }));

  return {
    title: "RRR on Wheels report",
    sections: [
      { name: "By vehicle", rows: byVehicle },
      { name: "By driver", rows: byDriver },
      { name: "By waste category", rows: byCategory },
      { name: "Dispatches by vendor", rows: byVendor },
      { name: "Entries", rows: entryRows },
    ],
  };
}

/* ------------------------------------------ 16  Special collection report */

export function specialReport({ data, range, area, collectedBy }) {
  const entries = data.inwardSpecial.filter(
    (r) =>
      live(r) && inPeriod(r.Collection_Date, range) &&
      (!area || r.Area === area) &&
      (!collectedBy || r.Collected_By === collectedBy)
  );

  const codes = new Set(entries.map((r) => r.Entry_Code));
  const lines = data.entryCategories.filter(
    (l) => l.Source_Type === "SPECIAL" && codes.has(l.Entry_Ref_Id)
  );

  const entryRows = entries
    .sort((a, b) => String(a.Collection_Date).localeCompare(String(b.Collection_Date)))
    .map((e) => ({
      Date: e.Collection_Date,
      Code: e.Entry_Code,
      Location: e.Location,
      Area: e.Area,
      Collected_By: e.Collected_By,
      Who: e.Vendor_Code || e.Vehicle_Code || "—",
      Collected_Kg: kg2(e.Total_Waste_Collected_Kg),
    }));

  const byLocation = groupSum(entries, "Location", "Total_Waste_Collected_Kg").map(([place, total]) => ({
    Location: place, Collected_Kg: kg2(total),
  }));

  const byCategory = groupSum(lines, "Waste_Category", "Quantity_Kg").map(([name, total]) => ({
    Category: name, Quantity_Kg: kg2(total),
  }));

  const dispatches = data.dispatch.filter(
    (d) => live(d) && d.Source_Type === "SPECIAL" && inPeriod(d.Dispatch_Date, range)
  );
  const byVendor = groupSum(dispatches, "Vendor_Code", "Total_Quantity_Kg").map(([code, total]) => ({
    Vendor: code, Dispatched_Kg: kg2(total),
  }));

  return {
    title: "Special collection report",
    sections: [
      { name: "Entries", rows: entryRows },
      { name: "By location", rows: byLocation },
      { name: "By waste category", rows: byCategory },
      { name: "Dispatches by vendor", rows: byVendor },
    ],
  };
}

/* ----------------------------------------------------- 16  Vendor report */

export function vendorReport({ data, range, vendorCode, certificateGroups }) {
  const vendors = vendorCode
    ? data.vendors.filter((v) => v.Vendor_Code === vendorCode)
    : data.vendors;

  const collected = [];
  const dispatchedByGroup = [];
  const dispatchedByPurpose = [];
  const certificates = [];
  const diversions = [];

  for (const vendor of vendors) {
    const code = vendor.Vendor_Code;

    // Kg collected through the BWGs linked to this vendor.
    const collectedKg = data.inwardBwg
      .filter((r) => live(r) && r.Vendor_Code === code && inPeriod(r.Collection_Date, range))
      .reduce((sum, r) => sum + n(r.Waste_Collected_Kg), 0);

    const toVendor = data.dispatch.filter(
      (d) => live(d) && d.Vendor_Code === code && inPeriod(d.Dispatch_Date, range)
    );
    const dispatchedKg = toVendor.reduce((sum, d) => sum + n(d.Total_Quantity_Kg), 0);

    collected.push({
      Vendor: `${code} — ${vendor.Vendor_Name}`,
      Collected_Via_BWGs_Kg: kg2(collectedKg),
      Dispatched_To_Vendor_Kg: kg2(dispatchedKg),
    });

    const codes = new Set(toVendor.map((d) => d.Dispatch_Code));
    const lines = data.dispatchLines.filter((l) => codes.has(l.Dispatch_Code));

    for (const [group, total] of groupSum(lines, "Material_Group", "Quantity_Kg")) {
      dispatchedByGroup.push({ Vendor: code, Material_Group: group, Quantity_Kg: kg2(total) });
    }
    for (const [purpose, total] of groupSum(toVendor, "Purpose", "Total_Quantity_Kg")) {
      const financials = [...new Set(toVendor.filter((d) => d.Purpose === purpose).map((d) => d.Financials))];
      dispatchedByPurpose.push({
        Vendor: code, Purpose: purpose, Quantity_Kg: kg2(total),
        Financials: financials.join(", ") || "—",
      });
    }

    for (const row of certificateRows({
      vendorCode: code,
      dispatch: data.dispatch,
      dispatchLines: data.dispatchLines,
      certificates: data.vendorCertificates,
      certificateGroups,
    })) {
      certificates.push({
        Vendor: code, Material_Group: row.group,
        Dispatched_Kg: row.dispatched, Certified_Kg: row.certified, Pending_Kg: row.pending,
      });
    }

    for (const d of data.diversionCertificates.filter((d) => d.Vendor_Code === code)) {
      diversions.push({
        Certificate_No: d.Diversion_Certificate_No,
        Date: d.Certificate_Date,
        BWG: d.BWG_Code,
        Material_Group: d.Material_Group,
        Quantity_Kg: kg2(d.Quantity_Kg),
        Status: d.Status || "Active",
      });
    }
  }

  return {
    title: "Vendor report",
    sections: [
      { name: "Collection and dispatch", rows: collected },
      { name: "Dispatched by material group", rows: dispatchedByGroup },
      { name: "Dispatched by purpose and financials", rows: dispatchedByPurpose },
      { name: "Certificates received and pending", rows: certificates },
      { name: "Diversion certificates issued", rows: diversions },
    ],
  };
}

/* ------------------------------------------------------- 16  Area report */

export function areaReport({ data, range, area }) {
  const sources = [
    ["MMRF / RRR Centres", data.inwardMmrf, "Waste_Collected_Kg"],
    ["RRR on Wheels", data.inwardRrr, "Total_Waste_Collected_Kg"],
    ["BWGs", data.inwardBwg, "Waste_Collected_Kg"],
    ["Special collection", data.inwardSpecial, "Total_Waste_Collected_Kg"],
  ];

  const collection = sources.map(([label, rows, column]) => {
    const matching = rows.filter(
      (r) => live(r) && inPeriod(r.Collection_Date, range) && (!area || r.Area === area)
    );
    return {
      Source: label,
      Entries: matching.length,
      Collected_Kg: kg2(matching.reduce((sum, r) => sum + n(r[column]), 0)),
    };
  });

  const dispatches = data.dispatch.filter(
    (d) => live(d) && inPeriod(d.Dispatch_Date, range) && (!area || !d.Area || d.Area === area)
  );

  const dispatchRows = groupSum(dispatches, "Source_Type", "Total_Quantity_Kg").map(([source, total]) => ({
    Source: source, Dispatched_Kg: kg2(total),
  }));

  const purposeRows = groupSum(dispatches, "Purpose", "Total_Quantity_Kg").map(([purpose, total]) => ({
    Purpose: purpose, Dispatched_Kg: kg2(total),
  }));

  return {
    title: `Area report${area ? ` — ${area}` : ""}`,
    sections: [
      { name: "Collection by source", rows: collection },
      { name: "Dispatch by source", rows: dispatchRows },
      { name: "Dispatch by purpose", rows: purposeRows },
    ],
  };
}

/* ------------------------------------------------------ 16  Stock report */

export function stockReport({ data, range, sourceType }) {
  if (sourceType === "MMRF") {
    const names = nameMap(data.mmrfs, "MMRF_Code", "MMRF_Name");
    const rows = mmrfStock({
      inwardMmrf: data.inwardMmrf, dispatch: data.dispatch,
      from: range.from, to: range.to,
    }).map((s) => ({
      Level: "MMRF", Name: `${s.code} — ${names[s.code] || ""}`,
      Opening_Kg: kg2(s.opening), Collected_Kg: kg2(s.collected),
      Dispatched_Kg: kg2(s.dispatched), Closing_Kg: kg2(s.closing),
    }));
    return { title: "Stock report — MMRF / RRR Centres", sections: [{ name: "Stock", rows }] };
  }

  const categories = categoryStock({
    sourceType,
    entryCategories: data.entryCategories,
    dispatch: data.dispatch,
    dispatchLines: data.dispatchLines,
    from: range.from, to: range.to,
  });

  const rows = [];
  for (const stream of groupStock(categories)) {
    rows.push({
      Level: "Stream", Name: stream.name,
      Opening_Kg: kg2(stream.opening), Collected_Kg: kg2(stream.collected),
      Dispatched_Kg: kg2(stream.dispatched), Closing_Kg: kg2(stream.closing),
    });
    for (const group of stream.groups) {
      rows.push({
        Level: "Material group", Name: group.name,
        Opening_Kg: kg2(group.opening), Collected_Kg: kg2(group.collected),
        Dispatched_Kg: kg2(group.dispatched), Closing_Kg: kg2(group.closing),
      });
      for (const item of group.items) {
        rows.push({
          Level: "Category", Name: item.name,
          Opening_Kg: kg2(item.opening), Collected_Kg: kg2(item.collected),
          Dispatched_Kg: kg2(item.dispatched), Closing_Kg: kg2(item.closing),
        });
      }
    }
  }

  return { title: `Stock report — ${sourceType}`, sections: [{ name: "Stock", rows }] };
}

/** Columns are taken from the first row, so a builder needs no column list. */
export function columnsOf(rows) {
  if (!rows?.length) return [];
  return Object.keys(rows[0]).map((key) => ({
    key,
    header: key.replace(/_/g, " "),
  }));
}

export { certificatesWithRemaining };
