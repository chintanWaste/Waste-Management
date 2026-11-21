import { useMemo, useState } from "react";
import Badge from "../../components/common/Badge";
import Card from "../../components/common/Card";
import DataTable from "../../components/common/DataTable";
import { SelectInput } from "../../components/common/Field";
import PageHeader from "../../components/common/PageHeader";
import { AUDIT_LOG } from "../../config/driveSchema";
import { useSheetData } from "../../hooks/useSheetData";
import { dateTime } from "../../utils/format";

const TONE = {
  Create: "ok", Edit: "info", Approve: "ok", Reject: "danger",
  Delete: "danger", Restore: "warn", Activate: "ok", Deactivate: "muted",
};

/** Section 4.8 / 17.4 — every create, edit, approval, delete and restore. */
export default function AuditLogPage() {
  const { rows, loading, error, reload } = useSheetData(AUDIT_LOG.tab);

  const [action, setAction] = useState("");
  const [recordType, setRecordType] = useState("");

  const actions = useMemo(
    () => [...new Set(rows.map((r) => r.Action).filter(Boolean))].sort(),
    [rows]
  );
  const types = useMemo(
    () => [...new Set(rows.map((r) => r.Record_Type).filter(Boolean))].sort(),
    [rows]
  );

  const filtered = useMemo(
    () =>
      rows
        .filter(
          (r) =>
            (!action || r.Action === action) &&
            (!recordType || r.Record_Type === recordType)
        )
        .sort((a, b) => String(b.Timestamp).localeCompare(String(a.Timestamp))),
    [rows, action, recordType]
  );

  return (
    <>
      <PageHeader
        title="Audit Log"
        description="Every create, edit, approval, delete, restore, activate and deactivate, with the user, the time, and the old and new values."
      />

      <div className="filterbar">
        <SelectInput
          label="Action" value={action} onChange={(e) => setAction(e.target.value)}
          options={actions} placeholder="All actions"
        />
        <SelectInput
          label="Record Type" value={recordType} onChange={(e) => setRecordType(e.target.value)}
          options={types} placeholder="All records"
        />
        <div className="u-grow" />
        <button
          className="btn btn--secondary"
          onClick={() => { setAction(""); setRecordType(""); }}
        >
          Clear filters
        </button>
      </div>

      <Card title="Activity" subtitle={`${filtered.length} entries`} flush>
        <DataTable
          rows={filtered} loading={loading} error={error} onRetry={reload}
          exportName="Audit_Log" emptyText="No activity recorded yet"
          columns={[
            { key: "Timestamp", header: "When", render: (r) => dateTime(r.Timestamp) },
            { key: "User_Name", header: "User", render: (r) => r.User_Name || r.User_Id || "—" },
            {
              key: "Action", header: "Action",
              render: (r) => <Badge tone={TONE[r.Action] || "muted"}>{r.Action}</Badge>,
            },
            { key: "Record_Type", header: "Record Type" },
            {
              key: "Record_Ref_Id", header: "Record",
              render: (r) => <span className="table__code">{r.Record_Ref_Id}</span>,
            },
            { key: "Field_Changed", header: "Field", render: (r) => r.Field_Changed || "—" },
            {
              key: "Old_Value", header: "From",
              render: (r) => <span className="diff-old">{r.Old_Value || "—"}</span>,
            },
            {
              key: "New_Value", header: "To",
              render: (r) => <span className="diff-new">{r.New_Value || "—"}</span>,
            },
            { key: "Remark", header: "Remark", render: (r) => r.Remark || "—" },
          ]}
        />
      </Card>
    </>
  );
}
