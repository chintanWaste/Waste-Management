import { useMemo, useState } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import Badge from "../../components/common/Badge";
import Card from "../../components/common/Card";
import ConfirmDialog from "../../components/common/ConfirmDialog";
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

/** Record_Type is the sheet's own tab name, which reads better unhyphenated. */
const tabLabel = (type) => String(type || "").replace(/_/g, " ");

/** Section 4.7 / 17.2 — records deleted recently, restorable for a few days. */
export default function DeletedItemsPage() {
  const { user } = useAuth();
  const { number } = useSettings();
  const toast = useToast();
  const { rows, loading, error, reload } = useSheetData(DELETED_ITEMS.tab);

  const [busy, setBusy] = useState("");
  const [confirming, setConfirming] = useState(null);
  const retention = number(SETTING.deletedItemsRetentionDays, 7);

  const items = useMemo(
    () =>
      rows
        .map((row) => ({ ...row, left: daysLeft(row, retention) }))
        .sort((a, b) => String(b.Deleted_On).localeCompare(String(a.Deleted_On))),
    [rows, retention]
  );

  const restorable = items.filter((row) => !row.Restored_On && row.left > 0);

  const restore = async () => {
    const row = confirming;
    if (!row) return;

    setBusy(row.Deletion_Id);
    try {
      const { rebuilt } = await restoreDeleted({ row, user, retentionDays: retention });
      setConfirming(null);
      toast.success(
        `${row.Record_Ref_Id} restored`,
        rebuilt
          ? `It has been written back into the ${tabLabel(row.Record_Type)} tab and is active again.`
          : "It is active again."
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
            { key: "Record_Type", header: "Type", render: (row) => tabLabel(row.Record_Type) },
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
                      onClick={() => setConfirming(row)}
                      disabled={Boolean(busy)}
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

      <ConfirmDialog
        open={Boolean(confirming)}
        title="Restore this record?"
        subtitle={
          confirming
            ? `${confirming.Record_Ref_Id} — ${confirming.Record_Label || confirming.Record_Type}`
            : ""
        }
        message={
          confirming
            ? `It will be written back into the ${tabLabel(confirming.Record_Type)} tab as an ` +
              "active record, exactly as it was when it was deleted."
            : ""
        }
        note="It goes back at the end of its tab rather than in its original position — the data is the same, the row order is not."
        confirmLabel="Restore"
        tone="primary"
        busy={Boolean(busy)}
        busyText="Restoring the record…"
        onConfirm={restore}
        onCancel={() => setConfirming(null)}
      />
    </>
  );
}
