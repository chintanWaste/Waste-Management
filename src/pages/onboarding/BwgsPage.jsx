import { useCallback, useEffect, useState } from "react";
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
import { BWGS, isWriteConfigured } from "../../config/driveSchema";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { viewUrl } from "../../services/drive";
import { deleteBwg, loadBwgDirectory } from "../../services/bwgService";
import { date } from "../../utils/format";
import BwgForm from "./BwgForm";

/** Sections 8.1–8.2 — Create BWG form at the top, BWG directory below. */
export default function BwgsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const canSave = isWriteConfigured();

  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const [removing, setRemoving] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { bwgs } = await loadBwgDirectory();
      setRows(bwgs);
    } catch (err) {
      setError(err.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const confirmDelete = useCallback(async () => {
    const row = confirming;
    if (!row) return;

    setRemoving(row.BWG_Code);
    try {
      await deleteBwg({ code: row.BWG_Code, label: row.BWG_Name, user });
      // Taken off the table here: the CSV endpoint can still be serving the
      // pre-delete copy, which a refetch would put straight back.
      setRows((prev) => prev.filter((r) => r.BWG_Code !== row.BWG_Code));
      setConfirming(null);
      toast.success(`BWG ${row.BWG_Code} deleted`, `${row.BWG_Name} has been removed and archived.`);
    } catch (err) {
      toast.error("Could not delete the BWG", err.message);
    } finally {
      setRemoving("");
    }
  }, [confirming, toast, user]);

  const columns = [
    {
      key: "BWG_Code", header: "Code",
      render: (r) => <span className="table__code">{r.BWG_Code}</span>,
    },
    { key: "BWG_Name", header: "BWG Name" },
    {
      key: "BWG_Type", header: "Type",
      render: (r) =>
        r.BWG_Type === "Others" && r.BWG_Type_Other
          ? `Others — ${r.BWG_Type_Other}`
          : r.BWG_Type || "—",
    },
    { key: "Area", header: "Area" },
    { key: "Operation_Type", header: "Operation Type" },
    { key: "Collection_Frequency", header: "Frequency" },
    {
      key: "Linked_Vendor", header: "Linked Vendor",
      render: (r) =>
        r.Linked_Vendor || <span className="u-muted">Not linked</span>,
    },
    {
      key: "Onboarding_Date", header: "Onboarded",
      render: (r) => date(r.Onboarding_Date),
    },
    {
      key: "Status", header: "Status",
      render: (r) => <Badge>{r.Status || "Active"}</Badge>,
    },
    {
      key: "Documents_File_Id", header: "Documents", sortable: false,
      render: (r) =>
        r.Documents_File_Id ? (
          <a
            href={viewUrl(r.Documents_File_Id)}
            target="_blank"
            rel="noreferrer"
            className="u-row"
            style={{ gap: 4 }}
          >
            PDF <ExternalLink size={12} aria-hidden="true" />
          </a>
        ) : "—",
      exportValue: (r) => viewUrl(r.Documents_File_Id),
    },
    rowActionsColumn({
      idKey: "BWG_Code",
      canWrite: canSave,
      busyId: removing,
      labelFor: (r) => r.BWG_Code,
      onView: setViewing,
      onEdit: setEditing,
      onDelete: setConfirming,
    }),
  ];

  return (
    <>
      <PageHeader
        title="BWG Onboarding"
        description="Every Bulk Waste Generator whose waste is collected by Chintan's designated vendors. A BWG appears in daily inward entry from its onboarding date, once it is linked to a vendor."
        actions={
          <Button onClick={() => setFormOpen(true)}>
            <Plus size={15} aria-hidden="true" />
            Create BWG
          </Button>
        }
      />

      <Modal
        open={formOpen}
        title="Create BWG"
        subtitle="All fields are required except Ward / Zone"
        onClose={() => setFormOpen(false)}
        busy={saving}
        busyText="Creating BWG — uploading the PDF and saving to the sheet…"
      >
        <BwgForm
          onCreated={() => { setFormOpen(false); load(); }}
          onCancel={() => setFormOpen(false)}
          onBusyChange={setSaving}
        />
      </Modal>

      <Modal
        open={Boolean(editing)}
        title={`Edit BWG ${editing?.BWG_Code || ""}`}
        subtitle="The documents PDF is only replaced if you choose a new one"
        onClose={() => setEditing(null)}
        busy={saving}
        busyText="Saving changes to the sheet…"
      >
        {/* Keyed so switching rows rebuilds the form with the new values. */}
        <BwgForm
          key={editing?.BWG_Code}
          bwg={editing}
          onCreated={() => { setEditing(null); load(); }}
          onCancel={() => setEditing(null)}
          onBusyChange={setSaving}
        />
      </Modal>

      <Modal
        open={Boolean(viewing)}
        title={`BWG ${viewing?.BWG_Code || ""}`}
        subtitle={viewing?.BWG_Name}
        onClose={() => setViewing(null)}
      >
        <RecordDetails tab={BWGS.tab} row={viewing} hide={["BWG_Code", "BWG_Name"]} />
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
        title="Delete this BWG?"
        subtitle={confirming ? `${confirming.BWG_Code} — ${confirming.BWG_Name}` : ""}
        message={confirming ? `${confirming.BWG_Name} will be removed from the BWGs tab of the sheet.` : ""}
        note="A full copy is archived to Deleted_Items before the row is removed, so it can still be restored."
        confirmLabel="Delete BWG"
        busy={Boolean(removing)}
        busyText="Deleting and archiving…"
        onConfirm={confirmDelete}
        onCancel={() => setConfirming(null)}
      />

      <Card title="BWG Directory" flush>
        <DataTable
          columns={columns}
          rows={rows}
          loading={loading}
          error={error}
          onRetry={load}
          exportName="BWGs"
          emptyText="No BWGs onboarded yet"
        />
      </Card>
    </>
  );
}
