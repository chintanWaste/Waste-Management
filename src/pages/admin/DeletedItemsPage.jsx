import { useMemo, useState } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import Badge from "../../components/common/Badge";
import Card from "../../components/common/Card";
import DataTable from "../../components/common/DataTable";
import PageHeader from "../../components/common/PageHeader";
import { Banner } from "../../components/common/States";
import { SETTING } from "../../config/appConfig";
import { DELETED_ITEMS } from "../../config/driveSchema";
import { useAuth } from "../../context/AuthContext";
import { useSettings } from "../../context/SettingsContext";
import { useToast } from "../../context/ToastContext";
import { useSheetData } from "../../hooks/useSheetData";
import { daysLeft, restoreDeleted } from "../../services/adminService";
import { dateTime } from "../../utils/format";

/** Section 4.7 / 17.2 — records deleted recently, restorable for a few days. */
export default function DeletedItemsPage() {
  const { user } = useAuth();
  const { number } = useSettings();
  const toast = useToast();
  const { rows, loading, error, reload } = useSheetData(DELETED_ITEMS.tab);

  const [busy, setBusy] = useState("");
  const retention = number(SETTING.deletedItemsRetentionDays, 7);

  const items = useMemo(
    () =>
      rows
        .map((row) => ({ ...row, left: daysLeft(row, retention) }))
        .sort((a, b) => String(b.Deleted_On).localeCompare(String(a.Deleted_On))),
    [rows, retention]
  );

  const restorable = items.filter((row) => !row.Restored_On && row.left > 0);

  const restore = async (row) => {
    if (!window.confirm(`Restore ${row.Record_Type} ${row.Record_Ref_Id}?`)) return;
    setBusy(row.Deletion_Id);
    try {
      await restoreDeleted({ row, user });
      toast.success(
        `${row.Record_Ref_Id} restored`,
        "It is active again, with everything deleted alongside it."
      );
      reload();
    } catch (err) {
      toast.error("Could not restore the record", err.message);
    } finally {
      setBusy("");
    }
  };

  return (
    <>
      <PageHeader
        title="Deleted Items"
        description={
          `A deleted record can be restored for ${retention} days, together with everything ` +
          "that was deleted alongside it. After that it is removed permanently."
        }
      />

      {restorable.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Banner tone="warn">
            <b>
              {restorable.length} record{restorable.length === 1 ? "" : "s"} can still be restored.
            </b>{" "}
            The oldest has {Math.min(...restorable.map((row) => row.left))} day(s) left.
          </Banner>
        </div>
      )}

      <Card title="Recently Deleted" flush>
        <DataTable
          rows={items} loading={loading} error={error} onRetry={reload}
          exportName="Deleted_Items" emptyText="Nothing has been deleted"
          columns={[
            { key: "Record_Type", header: "Type" },
            {
              key: "Record_Ref_Id", header: "Code",
              render: (row) => <span className="table__code">{row.Record_Ref_Id}</span>,
            },
            { key: "Record_Label", header: "Record" },
            { key: "Deleted_By", header: "Deleted By", render: (row) => row.Deleted_By || "—" },
            { key: "Deleted_On", header: "Deleted On", render: (row) => dateTime(row.Deleted_On) },
            {
              key: "left", header: "Days Left", align: "right",
              render: (row) => {
                if (row.Restored_On) return <Badge tone="ok">Restored</Badge>;
                if (row.left > 0) {
                  return (
                    <Badge tone={row.left <= 2 ? "danger" : "warn"}>
                      {row.left} day{row.left === 1 ? "" : "s"}
                    </Badge>
                  );
                }
                return <Badge tone="muted">Expired</Badge>;
              },
            },
            {
              key: "actions", header: "", sortable: false,
              render: (row) => {
                if (row.Restored_On) {
                  return <span className="u-small u-muted">{dateTime(row.Restored_On)}</span>;
                }
                if (row.left > 0) {
                  return (
                    <button
                      className="btn btn--ghost btn--sm"
                      onClick={() => restore(row)}
                      disabled={busy === row.Deletion_Id}
                    >
                      <RotateCcw size={13} aria-hidden="true" />
                      {busy === row.Deletion_Id ? "Restoring…" : "Restore"}
                    </button>
                  );
                }
                return (
                  <span className="u-small u-muted" title="Past the retention window">
                    <Trash2 size={12} aria-hidden="true" /> Gone
                  </span>
                );
              },
            },
          ]}
        />
      </Card>
    </>
  );
}
