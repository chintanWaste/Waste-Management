import { useEffect, useRef, useState } from "react";
import { ChevronDown, FileDown, FileSpreadsheet, FileText } from "lucide-react";
import { useSettings } from "../../context/SettingsContext";
import { SETTING } from "../../config/appConfig";
import { exportTable } from "../../utils/exporters";
import { useToast } from "../../context/ToastContext";

/**
 * Export to Excel or PDF.
 *
 * Disabled whenever there is nothing to export, so the button never produces an
 * empty file. The signatory printed on the PDF comes from the Settings tab.
 */
export default function ExportMenu({ fileName, title, meta = [], columns, rows, size = "sm" }) {
  const { text } = useSettings();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState("");
  const ref = useRef(null);

  const count = rows?.length || 0;
  const empty = count === 0;

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const run = async (format) => {
    setOpen(false);
    setBusy(format);
    try {
      await exportTable({
        format, fileName, title: title || fileName, meta, columns, rows,
        signatory: {
          name: text(SETTING.authorisedSignatoryName),
          designation: text(SETTING.authorisedSignatoryDesignation),
        },
      });
      toast.success(
        `${format === "pdf" ? "PDF" : "Excel file"} downloaded`,
        `${count} row${count === 1 ? "" : "s"} exported.`
      );
    } catch (err) {
      toast.error("Export failed", err.message);
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="exportmenu" ref={ref}>
      <button
        className={`btn btn--secondary ${size === "sm" ? "btn--sm" : ""}`}
        onClick={() => setOpen((o) => !o)}
        disabled={empty || Boolean(busy)}
        title={empty ? "Nothing to export yet" : `Export ${count} rows`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <FileDown size={14} aria-hidden="true" />
        {busy ? "Preparing…" : "Export"}
        <ChevronDown size={12} aria-hidden="true" />
      </button>

      {open && (
        <div className="exportmenu__panel" role="menu">
          <button className="exportmenu__item" onClick={() => run("excel")}>
            <FileSpreadsheet size={15} aria-hidden="true" />
            <span>
              Excel <span className="u-small u-muted">(.xlsx)</span>
            </span>
          </button>
          <button className="exportmenu__item" onClick={() => run("pdf")}>
            <FileText size={15} aria-hidden="true" />
            <span>
              PDF <span className="u-small u-muted">(printable)</span>
            </span>
          </button>
          <div className="exportmenu__note">{count} rows, as filtered on screen</div>
        </div>
      )}
    </div>
  );
}
