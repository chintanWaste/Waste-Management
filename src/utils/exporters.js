/**
 * Excel and PDF export, shared by every list, the stock page and reports.
 *
 * Both produce a real file: a genuine .xlsx workbook (not a renamed CSV) and a
 * PDF in Chintan's layout with a title block, the filters that produced it, and
 * space for signature and stamp (Annex D).
 *
 * Nothing is exported when there are no rows — the caller disables the button,
 * and these functions refuse as a second guard.
 */

import { APP } from "../config/appConfig";
import { dateTime, date as fmtDate } from "./format";

const stamp = () => new Date().toISOString().slice(0, 10);

/** Turn { key, header, render } columns + rows into a plain string matrix. */
export function toMatrix(columns, rows) {
  const header = columns.map((c) => c.header);
  const body = rows.map((row) =>
    columns.map((c) => {
      const value = c.exportValue ? c.exportValue(row) : row[c.key];
      if (value === null || value === undefined || value === "") return "";
      return typeof value === "object" ? String(row[c.key] ?? "") : String(value);
    })
  );
  return { header, body };
}

/* --------------------------------------------------------------- Excel */

/**
 * Writes a real .xlsx file.
 * `sheets` is [{ name, header, body, meta }] — meta lines are written above the
 * table so the filters that produced the figures travel with them.
 */
export async function exportExcel({ fileName, sheets }) {
  const usable = sheets.filter((s) => s.body && s.body.length);
  if (!usable.length) throw new Error("There is nothing to export yet.");

  const XLSX = await import("xlsx");
  const book = XLSX.utils.book_new();

  for (const sheet of usable) {
    const rows = [];
    rows.push([sheet.title || sheet.name]);
    rows.push([`${APP.org} · ${APP.name}`]);
    for (const line of sheet.meta || []) rows.push([line]);
    rows.push([`Generated ${dateTime(new Date())}`]);
    rows.push([]);
    rows.push(sheet.header);
    for (const row of sheet.body) rows.push(row);

    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Column widths from the longest cell in each column.
    ws["!cols"] = sheet.header.map((head, i) => {
      const longest = Math.max(
        String(head).length,
        ...sheet.body.map((r) => String(r[i] ?? "").length)
      );
      return { wch: Math.min(Math.max(longest + 2, 10), 42) };
    });

    // Freeze the header row of the table.
    ws["!freeze"] = { xSplit: 0, ySplit: (sheet.meta?.length || 0) + 5 };

    XLSX.utils.book_append_sheet(book, ws, sheet.name.slice(0, 31));
  }

  XLSX.writeFile(book, `${fileName}_${stamp()}.xlsx`, { compression: true });
}

/* ----------------------------------------------------------------- PDF */

/**
 * Writes a PDF in the report layout of Annex D: title block, period and
 * filters, the table, page numbers, and a signature block at the end.
 */
export async function exportPdf({
  fileName, title, subtitle, meta = [], header, body,
  orientation = "landscape", signatory, extraSections = [],
}) {
  if (!body || !body.length) throw new Error("There is nothing to export yet.");

  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation, unit: "pt", format: "a4" });
  const width = doc.internal.pageSize.getWidth();

  // ---- title block ----
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(15, 61, 46);
  doc.text(title, 40, 46);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90, 100, 95);
  doc.text(APP.org, 40, 62);
  if (subtitle) doc.text(subtitle, 40, 76);

  doc.setFontSize(8);
  doc.text(`Generated ${dateTime(new Date())}`, width - 40, 46, { align: "right" });

  let cursor = subtitle ? 92 : 78;
  for (const line of meta) {
    doc.text(line, 40, cursor);
    cursor += 12;
  }

  doc.setDrawColor(210, 220, 215);
  doc.line(40, cursor, width - 40, cursor);

  // ---- table ----
  autoTable(doc, {
    head: [header],
    body,
    startY: cursor + 10,
    margin: { left: 40, right: 40, bottom: 80 },
    styles: { fontSize: 8, cellPadding: 5, textColor: [60, 74, 69], lineColor: [227, 232, 230], lineWidth: 0.5 },
    headStyles: { fillColor: [228, 245, 236], textColor: [15, 61, 46], fontStyle: "bold", fontSize: 8 },
    alternateRowStyles: { fillColor: [250, 252, 251] },
    didDrawPage: () => {
      const page = doc.internal.getNumberOfPages();
      const height = doc.internal.pageSize.getHeight();
      doc.setFontSize(8);
      doc.setTextColor(140, 150, 145);
      doc.text(`Page ${page}`, width - 40, height - 24, { align: "right" });
      doc.text(`${APP.shortOrg} · ${title}`, 40, height - 24);
    },
  });

  // ---- further sections, each with its own heading ----
  for (const section of extraSections) {
    if (!section.body?.length) continue;

    let top = (doc.lastAutoTable?.finalY || cursor) + 34;
    if (top > doc.internal.pageSize.getHeight() - 150) {
      doc.addPage();
      top = 60;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(15, 61, 46);
    doc.text(section.name, 40, top);

    autoTable(doc, {
      head: [section.header],
      body: section.body,
      startY: top + 10,
      margin: { left: 40, right: 40, bottom: 80 },
      styles: { fontSize: 8, cellPadding: 5, textColor: [60, 74, 69], lineColor: [227, 232, 230], lineWidth: 0.5 },
      headStyles: { fillColor: [228, 245, 236], textColor: [15, 61, 46], fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: [250, 252, 251] },
    });
  }

  // ---- signature block (Annex D) ----
  const height = doc.internal.pageSize.getHeight();
  let y = (doc.lastAutoTable?.finalY || cursor) + 46;
  if (y > height - 110) {
    doc.addPage();
    y = 70;
  }

  doc.setDrawColor(150, 160, 155);
  doc.line(40, y + 34, 220, y + 34);
  doc.setFontSize(8);
  doc.setTextColor(90, 100, 95);
  doc.text("Authorised signatory", 40, y + 48);
  if (signatory?.name) {
    doc.setTextColor(40, 50, 45);
    doc.text(signatory.name, 40, y + 60);
    if (signatory.designation) doc.text(signatory.designation, 40, y + 72);
  }

  doc.setTextColor(90, 100, 95);
  doc.rect(width - 190, y, 150, 56);
  doc.text("Stamp", width - 118, y + 32);

  doc.save(`${fileName}_${stamp()}.pdf`);
}

/** Convenience wrapper for a single-table screen. */
export async function exportTable({ format, fileName, title, meta, columns, rows, signatory }) {
  const { header, body } = toMatrix(columns, rows);

  if (format === "pdf") {
    return exportPdf({ fileName, title, meta, header, body, signatory });
  }
  return exportExcel({
    fileName,
    sheets: [{ name: fileName.slice(0, 31), title, meta, header, body }],
  });
}

export { fmtDate };
