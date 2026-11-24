import { useMemo, useState } from "react";
import { FileSpreadsheet, FileText } from "lucide-react";
import Button from "../../components/common/Button";
import Card from "../../components/common/Card";
import PageHeader from "../../components/common/PageHeader";
import { Banner, EmptyState, SkeletonRows } from "../../components/common/States";
import { SETTING } from "../../config/appConfig";
import { useAuth } from "../../context/AuthContext";
import { useSettings } from "../../context/SettingsContext";
import { useToast } from "../../context/ToastContext";
import { useCategories } from "../../hooks/useCategories";
import { useSheets } from "../../hooks/useSheets";
import { exportExcel, exportPdf, toMatrix } from "../../utils/exporters";
import { date, num } from "../../utils/format";
import { resolvePeriod } from "../../utils/period";
import { columnsOf } from "../../utils/reports";
import ReportFilters from "./ReportFilters";
import { visibleReports } from "./reportCatalogue";

const INITIAL = {
  period: "this-month", from: "", to: "",
  area: "", mmrfCode: "", vehicleCode: "", driverCode: "",
  vendorCode: "", collectedBy: "", sourceType: "BWG",
};

/** Section 16 — reports, produced as PDF in the Annex D layout, or as Excel. */
export default function ReportsPage() {
  const { isSuperAdmin, canUseSource, user } = useAuth();
  const { text } = useSettings();
  const { certificateGroups } = useCategories();
  const toast = useToast();

  const reports = useMemo(
    () => visibleReports({ isSuperAdmin, canUseSource }),
    [isSuperAdmin, canUseSource]
  );

  const [reportKey, setReportKey] = useState(reports[0]?.key);
  const [filters, setFilters] = useState(INITIAL);
  const [busy, setBusy] = useState("");

  const report = reports.find((r) => r.key === reportKey) || reports[0];

  const { data, loading, error, reload } = useSheets([
    "vendors", "bwgs", "mmrfs", "vehicles", "drivers", "linkage",
    "inwardMmrf", "inwardRrr", "inwardBwg", "inwardSpecial",
    "entryCategories", "dispatch", "dispatchLines",
    "vendorCertificates", "diversionCertificates",
  ]);

  const range = useMemo(() => resolvePeriod(filters), [filters]);

  const built = useMemo(() => {
    if (!report || loading) return null;
    try {
      return report.build({ data, range, certificateGroups, ...filters });
    } catch (err) {
      return { title: report.label, sections: [], error: err.message };
    }
  }, [report, data, range, filters, certificateGroups, loading]);

  const meta = useMemo(() => {
    const lines = [`Period: ${date(range.from)} to ${date(range.to)}`];
    if (filters.area) lines.push(`Area: ${filters.area}`);
    if (filters.mmrfCode) lines.push(`Centre: ${filters.mmrfCode}`);
    if (filters.vehicleCode) lines.push(`Vehicle: ${filters.vehicleCode}`);
    if (filters.driverCode) lines.push(`Driver: ${filters.driverCode}`);
    if (filters.vendorCode) lines.push(`Vendor: ${filters.vendorCode}`);
    if (filters.collectedBy) lines.push(`Collected by: ${filters.collectedBy}`);
    if (report?.filters?.includes("sourceType")) lines.push(`Source type: ${filters.sourceType}`);
    return lines;
  }, [range, filters, report]);

  const filled = built?.sections.filter((s) => s.rows.length) || [];
  const totalRows = filled.reduce((sum, s) => sum + s.rows.length, 0);
  const empty = totalRows === 0;

  const signatory = {
    name: text(SETTING.authorisedSignatoryName),
    designation: text(SETTING.authorisedSignatoryDesignation),
  };

  const fileName = `${built?.title || "Report"}`.replace(/[^\w]+/g, "_");

  const downloadPdf = async () => {
    setBusy("pdf");
    try {
      // One PDF per report: each section becomes its own table, in order.
      const [first, ...rest] = filled;
      const { header, body } = toMatrix(columnsOf(first.rows), first.rows);

      await exportPdf({
        fileName,
        title: built.title,
        subtitle: first.name,
        meta,
        header,
        body,
        signatory,
        extraSections: rest.map((section) => {
          const matrix = toMatrix(columnsOf(section.rows), section.rows);
          return { name: section.name, header: matrix.header, body: matrix.body };
        }),
      });
      toast.success("PDF downloaded", `${built.title}, ${totalRows} rows.`);
    } catch (err) {
      toast.error("Could not produce the PDF", err.message);
    } finally {
      setBusy("");
    }
  };

  const downloadExcel = async () => {
    setBusy("excel");
    try {
      await exportExcel({
        fileName,
        sheets: filled.map((section) => {
          const { header, body } = toMatrix(columnsOf(section.rows), section.rows);
          return { name: section.name.slice(0, 31), title: `${built.title} — ${section.name}`, meta, header, body };
        }),
      });
      toast.success("Excel file downloaded", `${filled.length} sheets, ${totalRows} rows.`);
    } catch (err) {
      toast.error("Could not produce the Excel file", err.message);
    } finally {
      setBusy("");
    }
  };

  if (!reports.length) {
    return (
      <>
        <PageHeader title="Reports" />
        <Banner tone="warn">
          You have no source types assigned, so there are no reports to generate.
          Ask a Super Admin to assign your sources.
        </Banner>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Reports"
        description="Every report covers a period you choose and downloads as a PDF with space for signature and stamp, or as an Excel workbook with one sheet per section."
        actions={
          <>
            <Button variant="secondary" onClick={downloadExcel} disabled={empty || Boolean(busy)}>
              <FileSpreadsheet size={15} aria-hidden="true" />
              {busy === "excel" ? "Preparing…" : "Excel"}
            </Button>
            <Button onClick={downloadPdf} disabled={empty || Boolean(busy)}>
              <FileText size={15} aria-hidden="true" />
              {busy === "pdf" ? "Preparing…" : "Download PDF"}
            </Button>
          </>
        }
      />

      {!isSuperAdmin && (
        <div style={{ marginBottom: 16 }}>
          <Banner tone="info">
            Reports for your assigned sources only: {user?.sources?.join(", ") || "none"}.
            The Vendor report is available to Super Admins.
          </Banner>
        </div>
      )}

      <div className="reportpicker">
        {reports.map((r) => (
          <button
            key={r.key}
            className={`reportcard ${r.key === report.key ? "reportcard--active" : ""}`}
            onClick={() => setReportKey(r.key)}
          >
            <span className="reportcard__name">{r.label}</span>
            <span className="reportcard__desc">{r.description}</span>
          </button>
        ))}
      </div>

      <ReportFilters
        report={report}
        values={filters}
        onChange={setFilters}
        data={data}
        allowedSources={isSuperAdmin ? null : user?.sources}
      />

      {loading ? (
        <Card><SkeletonRows rows={6} /></Card>
      ) : error ? (
        <Card><EmptyState title="Could Not Load" text={error} /></Card>
      ) : built?.error ? (
        <Card><EmptyState title="Could Not Build This Report" text={built.error} /></Card>
      ) : empty ? (
        <Card>
          <EmptyState
            title="Nothing in This Period"
            text="No records match the filters above. Widen the period or clear a filter."
          />
        </Card>
      ) : (
        filled.map((section) => {
          // Worked out once per section rather than for every cell.
          const columns = columnsOf(section.rows);

          return (
          <div key={section.name} style={{ marginBottom: 16 }}>
            <Card title={section.name} subtitle={`${section.rows.length} rows`} flush>
              <div className="tablewrap">
                <table className="table">
                  <thead>
                    <tr>
                      {columns.map((c) => (
                        <th key={c.key} style={{ textAlign: c.align }}>{c.header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {section.rows.slice(0, 100).map((row, i) => (
                      <tr key={i}>
                        {columns.map((c) => (
                          <td
                            key={c.key}
                            className={c.numeric ? "u-right u-mono" : ""}
                          >
                            {typeof row[c.key] === "number"
                              ? num(row[c.key], c.decimals)
                              : row[c.key] ?? "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {section.rows.length > 100 && (
                <div className="u-small u-muted" style={{ padding: "10px 16px" }}>
                  Showing the first 100 rows — the download contains all {section.rows.length}.
                </div>
              )}
            </Card>
          </div>
          );
        })
      )}
    </>
  );
}
