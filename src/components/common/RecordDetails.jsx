import { ExternalLink } from "lucide-react";
import Badge from "./Badge";
import { TAB_BY_NAME, isFileColumn } from "../../config/driveSchema";
import { toFileIds, viewUrl } from "../../services/drive";
import { date, dateTime } from "../../utils/format";

/** Column name to label: Bank_Account_Name -> Bank Account Name. */
const labelOf = (column) =>
  column
    .replace(/_File_Ids?$/, "")
    .replace(/_/g, " ")
    .replace(/\bKg\b/, "kg")
    .trim();

const AUDIT_COLUMNS = new Set([
  "Created_By", "Created_On", "Updated_By", "Updated_On", "Approval_Status",
]);

const isDateColumn = (c) => /_Date$|^Date_|_Validity_Date$/.test(c);
const isTimestamp = (c) => /_On$|^Timestamp$|_At$/.test(c);

function Value({ column, raw }) {
  const text = String(raw ?? "").trim();
  if (!text) return "—";

  if (isFileColumn(column)) {
    const ids = toFileIds(text);
    if (!ids.length) return "—";
    return (
      <div className="u-col" style={{ gap: 4 }}>
        {ids.map((id, i) => (
          <a
            key={id}
            href={viewUrl(id)}
            target="_blank"
            rel="noreferrer"
            className="u-row"
            style={{ gap: 4 }}
          >
            {ids.length > 1 ? `File ${i + 1}` : "Open the file"}
            <ExternalLink size={12} aria-hidden="true" />
          </a>
        ))}
      </div>
    );
  }

  if (column === "Status" || column === "Approval_Status") return <Badge>{text}</Badge>;
  if (isTimestamp(column)) return dateTime(text);
  if (isDateColumn(column)) return date(text);

  // Multi-value cells are stored pipe-separated.
  if (text.includes("|")) return text.split("|").filter(Boolean).join(", ");

  return text;
}

/**
 * Read-only view of one row of any tab, built from the tab's own column list.
 *
 * Driven by config/driveSchema.js rather than a hand-written field list per
 * screen, so every directory can offer View without its own dialog, and a
 * column added to the schema shows up here with no further change.
 *
 * `hide` drops columns that are already obvious from the dialog's title.
 */
export default function RecordDetails({ tab, row, hide = [] }) {
  if (!row) return null;

  const schema = TAB_BY_NAME[tab];
  // Fall back to whatever the row itself carries, for a tab not in the schema.
  const columns = (schema?.columns || Object.keys(row)).filter((c) => !hide.includes(c));

  const main = columns.filter((c) => !AUDIT_COLUMNS.has(c));
  const audit = columns.filter((c) => AUDIT_COLUMNS.has(c));

  const block = (list) => (
    <div className="formgrid">
      {list.map((column) => (
        <div key={column}>
          <div className="u-small u-muted">{labelOf(column)}</div>
          <div style={{ marginTop: 2 }}>
            <Value column={column} raw={row[column]} />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <>
      <div className="formsection">{block(main)}</div>

      {audit.length > 0 && (
        <div className="formsection">
          <div className="formsection__title">Record</div>
          {block(audit)}
        </div>
      )}
    </>
  );
}
