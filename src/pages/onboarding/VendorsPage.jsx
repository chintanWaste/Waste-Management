import { ExternalLink, Pencil, Plug, Plus } from "lucide-react";
import { useCallback, useState } from "react";
import Badge from "../../components/common/Badge";
import Button from "../../components/common/Button";
import Card from "../../components/common/Card";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import DataTable from "../../components/common/DataTable";
import Modal from "../../components/common/Modal";
import PageHeader from "../../components/common/PageHeader";
import { isDeletedRow, rowActionsColumn } from "../../components/common/rowActions";
import { Banner } from "../../components/common/States";
import {
  VENDORS, isDriveConfigured, isWriteConfigured, writeUrlProblem,
} from "../../config/driveSchema";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useSheetData } from "../../hooks/useSheetData";
import { viewUrl } from "../../services/drive";
import { deleteVendor } from "../../services/vendorService";
import { date } from "../../utils/format";
import VendorDetails from "./VendorDetails";
import VendorForm from "./VendorForm";

/** Sections 7.1–7.3 — Create vendor form at the top, directory below. */
export default function VendorsPage() {
  const { user } = useAuth();
  const toast = useToast();

  const connected = isDriveConfigured();
  const canSave = isWriteConfigured();
  const urlProblem = writeUrlProblem();

  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null); // the vendor row being edited
  const [viewing, setViewing] = useState(null); // the vendor row being viewed
  const [confirming, setConfirming] = useState(null); // the vendor awaiting a delete confirmation
  const [removing, setRemoving] = useState("");       // Vendor_Code currently deleting

  const { rows, loading, error, reload, addRow } = useSheetData(VENDORS.tab, { enabled: connected });

  /**
   * The new vendor goes into the table before the refetch, because the Sheet
   * CSV endpoint can still be serving the pre-append copy for a second or two.
   */
  const handleCreated = useCallback(
    ({ row }) => {
      setFormOpen(false);
      addRow(row);
      reload();
    },
    [addRow, reload]
  );

  const handleUpdated = useCallback(() => {
    setEditing(null);
    reload();
  }, [reload]);

  /**
   * Deleting is soft: the Apps Script sets Status to Deleted and archives a
   * copy to Deleted_Items, so this can be undone from the admin screens.
   */
  const confirmDelete = useCallback(async () => {
    const row = confirming;
    if (!row) return;

    setRemoving(row.Vendor_Code);
    try {
      await deleteVendor({ code: row.Vendor_Code, label: row.Vendor_Name, user });
      toast.success(`Vendor ${row.Vendor_Code} deleted`, `${row.Vendor_Name} has been removed from the sheet and archived.`);
      setConfirming(null);
      reload();
    } catch (err) {
      toast.error("Could not delete the vendor", err.message);
    } finally {
      setRemoving("");
    }
  }, [confirming, reload, toast, user]);

  const columns = [
    { key: "Vendor_Code", header: "Code", render: (r) => <span className="table__code">{r.Vendor_Code}</span> },
    { key: "Vendor_Name", header: "Vendor Name" },
    { key: "Vendor_Type", header: "Type" },
    { key: "Contact_Person", header: "Contact Person" },
    { key: "Phone", header: "Phone" },
    { key: "GST_Registered", header: "GST" },
    { key: "MoU_Type", header: "MoU" },
    { key: "MoU_End_Date", header: "MoU Ends", render: (r) => date(r.MoU_End_Date) },
    { key: "Onboarding_Date", header: "Onboarded", render: (r) => date(r.Onboarding_Date) },
    { key: "Status", header: "Status", render: (r) => <Badge>{r.Status || "Active"}</Badge> },
    {
      key: "Documents_File_Id",
      header: "Documents",
      sortable: false,
      // The cell shows a short "PDF" link; an export needs the address itself,
      // which is of no use as the word "PDF" in a spreadsheet.
      exportValue: (r) => viewUrl(r.Documents_File_Id),
      render: (r) =>
        r.Documents_File_Id ? (
          <a href={viewUrl(r.Documents_File_Id)} target="_blank" rel="noreferrer" className="u-row" style={{ gap: 4 }}>
            PDF <ExternalLink size={12} aria-hidden="true" />
          </a>
        ) : "—",
    },
    rowActionsColumn({
      idKey: "Vendor_Code",
      canWrite: canSave,
      busyId: removing,
      labelFor: (r) => r.Vendor_Code,
      onView: setViewing,
      onEdit: setEditing,
      onDelete: setConfirming,
    }),
  ];

  return (
    <>
      <PageHeader
        title="Vendor Onboarding"
        description="Service providers and buyers — vendors that collect waste from BWGs and vendors that buy or process dispatched waste."
        actions={
          <Button onClick={() => setFormOpen(true)}>
            <Plus size={15} aria-hidden="true" />
            Create vendor
          </Button>
        }
      />

      <Modal
        open={formOpen}
        title="Create Vendor"
        subtitle="All fields are required unless marked otherwise"
        onClose={() => setFormOpen(false)}
        busy={saving}
        busyText="Creating vendor — uploading the PDF and saving to the sheet…"
      >
        <VendorForm
          onCreated={handleCreated}
          onCancel={() => setFormOpen(false)}
          onBusyChange={setSaving}
        />
      </Modal>

      <Modal
        open={Boolean(editing)}
        title={`Edit Vendor ${editing?.Vendor_Code || ""}`}
        subtitle="Change what you need — the documents PDF is only replaced if you choose a new one"
        onClose={() => setEditing(null)}
        busy={saving}
        busyText="Saving changes to the sheet…"
      >
        {/* Keyed so switching rows rebuilds the form with the new values. */}
        <VendorForm
          key={editing?.Vendor_Code}
          vendor={editing}
          onCreated={handleUpdated}
          onCancel={() => setEditing(null)}
          onBusyChange={setSaving}
        />
      </Modal>

      <Modal
        open={Boolean(viewing)}
        title={`Vendor ${viewing?.Vendor_Code || ""}`}
        subtitle={viewing?.Vendor_Name}
        onClose={() => setViewing(null)}
      >
        <VendorDetails vendor={viewing} />
        <div className="formactions">
          <Button variant="secondary" onClick={() => setViewing(null)}>Close</Button>
          {viewing && !isDeletedRow(viewing) && canSave && (
            <Button
              onClick={() => {
                setEditing(viewing);
                setViewing(null);
              }}
            >
              <Pencil size={14} aria-hidden="true" />
              Edit
            </Button>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirming)}
        title="Delete this vendor?"
        subtitle={confirming ? `${confirming.Vendor_Code} — ${confirming.Vendor_Name}` : ""}
        message={
          confirming
            ? `${confirming.Vendor_Name} will be removed from the Vendors tab of the sheet.`
            : ""
        }
        note="A full copy is archived to Deleted_Items before the row is removed, so it can still be restored."
        confirmLabel="Delete vendor"
        busy={Boolean(removing)}
        busyText="Deleting and archiving…"
        onConfirm={confirmDelete}
        onCancel={() => setConfirming(null)}
      />

      {!connected && (
        <div style={{ marginBottom: 16 }}>
          <Banner tone="warn" icon={Plug}>
            Connect the Google Sheet (<code>VITE_SHEET_ID</code>) to list vendors here.
            The directory reads the <code>Vendors</code> tab.
          </Banner>
        </div>
      )}

      {urlProblem && (
        <div style={{ marginBottom: 16 }}>
          <Banner tone="danger">{urlProblem}</Banner>
        </div>
      )}

      {connected && !canSave && (
        <div style={{ marginBottom: 16 }}>
          <Banner tone="warn" icon={Plug}>
            Saving is not connected, so <strong>Create vendor</strong> cannot write to the
            sheet yet. Deploy the Apps Script Web App and set <code>VITE_SHEET_API_URL</code>
            {" "}in <code>.env</code> — see <code>apps-script/README.md</code>. Reading the
            directory below works without it.
          </Banner>
        </div>
      )}

      <Card title="Vendor Directory" flush>
        <DataTable
          columns={columns}
          rows={rows}
          loading={loading}
          error={error}
          onRetry={reload}
          exportName="Vendors"
          emptyText="No vendors onboarded yet"
        />
      </Card>
    </>
  );
}
