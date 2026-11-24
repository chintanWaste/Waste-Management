import { useCallback, useState } from "react";
import { ExternalLink, Pencil, Plus } from "lucide-react";
import Badge from "../../components/common/Badge";
import Button from "../../components/common/Button";
import Card from "../../components/common/Card";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import DataTable from "../../components/common/DataTable";
import Modal from "../../components/common/Modal";
import PageHeader from "../../components/common/PageHeader";
import RecordDetails from "../../components/common/RecordDetails";
import { rowActionsColumn } from "../../components/common/rowActions";
import { MMRFS, isWriteConfigured } from "../../config/driveSchema";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useSheetData } from "../../hooks/useSheetData";
import { viewUrl } from "../../services/drive";
import { deleteRecord } from "../../services/onboardingService";
import { num } from "../../utils/format";
import MmrfForm from "./MmrfForm";

/** Section 9 — MMRF / RRR Centre onboarding. All fields mandatory except email. */
export default function MmrfsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const canSave = isWriteConfigured();

  const { rows, loading, error, reload, addRow, removeRow } = useSheetData(MMRFS.tab);

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const [removing, setRemoving] = useState("");

  const handleCreated = useCallback(
    ({ row }) => {
      setOpen(false);
      addRow(row);
      reload();
    },
    [addRow, reload]
  );

  const handleUpdated = useCallback(() => {
    setEditing(null);
    reload();
  }, [reload]);

  const confirmDelete = useCallback(async () => {
    const row = confirming;
    if (!row) return;

    setRemoving(row.MMRF_Code);
    try {
      await deleteRecord({ tab: MMRFS, id: row.MMRF_Code, label: row.MMRF_Name, user });
      // Dropped here rather than by refetching: the CSV endpoint can still be
      // serving the pre-delete copy, which would put the row straight back.
      removeRow(MMRFS.idColumn, row.MMRF_Code);
      setConfirming(null);
      toast.success(`${row.MMRF_Code} deleted`, `${row.MMRF_Name} has been removed and archived.`);
    } catch (err) {
      toast.error("Could not delete the centre", err.message);
    } finally {
      setRemoving("");
    }
  }, [confirming, removeRow, toast, user]);

  const columns = [
    { key: "MMRF_Code", header: "Code", render: (r) => <span className="table__code">{r.MMRF_Code}</span> },
    { key: "MMRF_Name", header: "Name" },
    { key: "Area", header: "Area" },
    { key: "Location", header: "Location" },
    { key: "Operation_Type", header: "Operation Type" },
    { key: "In_Charge_Name", header: "In-charge" },
    { key: "Contact_Number", header: "Contact" },
    {
      key: "Capacity_Kg_Per_Day", header: "Capacity", align: "right",
      render: (r) => (r.Capacity_Kg_Per_Day ? `${num(r.Capacity_Kg_Per_Day, 0)} kg/day` : "—"),
    },
    { key: "Number_Of_Workers", header: "Workers", align: "right" },
    { key: "Status", header: "Status", render: (r) => <Badge>{r.Status || "Active"}</Badge> },
    {
      key: "MoU_File_Id", header: "MoU", sortable: false,
      // The cell shows a short link; an export needs the address itself.
      exportValue: (r) => viewUrl(r.MoU_File_Id),
      render: (r) =>
        r.MoU_File_Id ? (
          <a href={viewUrl(r.MoU_File_Id)} target="_blank" rel="noreferrer" className="u-row" style={{ gap: 4 }}>
            PDF <ExternalLink size={12} aria-hidden="true" />
          </a>
        ) : "—",
    },
    rowActionsColumn({
      idKey: "MMRF_Code",
      canWrite: canSave,
      busyId: removing,
      labelFor: (r) => r.MMRF_Code,
      onView: setViewing,
      onEdit: setEditing,
      onDelete: setConfirming,
    }),
  ];

  return (
    <>
      <PageHeader
        title="MMRF / RRR Centre Onboarding"
        description="The material recovery facilities and RRR Centres Chintan runs across Delhi. Capacity drives the capacity-use graph on the dashboard."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus size={15} aria-hidden="true" />
            Create centre
          </Button>
        }
      />

      <Modal
        open={open}
        title="Create MMRF / RRR Centre"
        subtitle="All fields are required except email"
        onClose={() => setOpen(false)}
        busy={saving}
        busyText="Creating centre — uploading the MoU and saving to the sheet…"
      >
        <MmrfForm
          rows={rows}
          onSaved={handleCreated}
          onCancel={() => setOpen(false)}
          onBusyChange={setSaving}
        />
      </Modal>

      <Modal
        open={Boolean(editing)}
        title={`Edit ${editing?.MMRF_Code || ""}`}
        subtitle="The MoU is only replaced if you choose a new one"
        onClose={() => setEditing(null)}
        busy={saving}
        busyText="Saving changes to the sheet…"
      >
        {/* Keyed so switching rows rebuilds the form with the new values. */}
        <MmrfForm
          key={editing?.MMRF_Code}
          mmrf={editing}
          rows={rows}
          onSaved={handleUpdated}
          onCancel={() => setEditing(null)}
          onBusyChange={setSaving}
        />
      </Modal>

      <Modal
        open={Boolean(viewing)}
        title={viewing?.MMRF_Code || ""}
        subtitle={viewing?.MMRF_Name}
        onClose={() => setViewing(null)}
      >
        <RecordDetails tab={MMRFS.tab} row={viewing} hide={["MMRF_Code", "MMRF_Name"]} />
        <div className="formactions">
          <Button variant="secondary" onClick={() => setViewing(null)}>Close</Button>
          {viewing && canSave && (
            <Button onClick={() => { setEditing(viewing); setViewing(null); }}>
              <Pencil size={14} aria-hidden="true" />
              Edit
            </Button>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirming)}
        title="Delete this centre?"
        subtitle={confirming ? `${confirming.MMRF_Code} — ${confirming.MMRF_Name}` : ""}
        message={confirming ? `${confirming.MMRF_Name} will be removed from the MMRFs tab of the sheet.` : ""}
        note="A full copy is archived to Deleted_Items before the row is removed, so it can still be restored."
        confirmLabel="Delete centre"
        busy={Boolean(removing)}
        busyText="Deleting and archiving…"
        onConfirm={confirmDelete}
        onCancel={() => setConfirming(null)}
      />

      <Card title="MMRF Directory" flush>
        <DataTable
          columns={columns} rows={rows} loading={loading} error={error}
          onRetry={reload} exportName="MMRFs" emptyText="No centres onboarded yet"
        />
      </Card>
    </>
  );
}
