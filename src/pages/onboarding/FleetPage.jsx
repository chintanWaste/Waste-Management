import { useCallback, useMemo, useState } from "react";
import { ExternalLink, Pencil, Plus, Power } from "lucide-react";
import Badge from "../../components/common/Badge";
import Button from "../../components/common/Button";
import Card from "../../components/common/Card";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import DataTable from "../../components/common/DataTable";
import Modal from "../../components/common/Modal";
import PageHeader from "../../components/common/PageHeader";
import RecordDetails from "../../components/common/RecordDetails";
import { rowActionsColumn } from "../../components/common/rowActions";
import { DRIVERS, VEHICLES, isWriteConfigured } from "../../config/driveSchema";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { deleteRecord, setRecordStatus } from "../../services/onboardingService";
import { SETTING } from "../../config/appConfig";
import { useSettings } from "../../context/SettingsContext";
import { useSheets } from "../../hooks/useSheets";
import { viewUrl } from "../../services/drive";
import { date } from "../../utils/format";
import { EXPIRY_STATE, TONE_FOR_STATE, expiryState } from "../../utils/expiry";
import DriverForm from "./DriverForm";
import VehicleForm from "./VehicleForm";

/** A validity date coloured red when expired, amber when close (section 10.3). */
function ValidityCell({ value, warnDays, notApplicable }) {
  if (notApplicable) return <span className="u-muted u-small">Not applicable</span>;
  if (!value) return "—";

  const state = expiryState(value, warnDays);
  if (state === EXPIRY_STATE.OK) return <span className="u-nowrap">{date(value)}</span>;

  return (
    <Badge tone={TONE_FOR_STATE[state]}>
      {date(value)}
      {state === EXPIRY_STATE.EXPIRED ? " · expired" : " · soon"}
    </Badge>
  );
}

/** Section 10 — vehicles and drivers on one page. */
export default function FleetPage() {
  const { number } = useSettings();
  const { user } = useAuth();
  const toast = useToast();
  const canSave = isWriteConfigured();
  const warnDays = number(SETTING.documentExpiryWarnDays, 30);
  const { data, loading, error, reload } = useSheets(["vehicles", "drivers"]);

  const [vehicleFormOpen, setVehicleFormOpen] = useState(false);
  const [driverFormOpen, setDriverFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // One set of dialog state per inventory, since both live on this page.
  const [editing, setEditing] = useState(null);   // { kind, row }
  const [viewing, setViewing] = useState(null);   // { kind, row }
  const [confirming, setConfirming] = useState(null); // { kind, row }
  const [removing, setRemoving] = useState("");

  /*
   * Codes deleted in this session. useSheets has no local-removal helper, and
   * the Sheet's CSV endpoint can still serve the pre-delete copy for a second
   * or two, so a refetch alone would put the row straight back on screen.
   */
  const [gone, setGone] = useState([]);
  const vehicles = useMemo(
    () => (data.vehicles || []).filter((r) => !gone.includes(r.Vehicle_Code)),
    [data.vehicles, gone]
  );
  const drivers = useMemo(
    () => (data.drivers || []).filter((r) => !gone.includes(r.Driver_Code)),
    [data.drivers, gone]
  );

  const KIND = {
    vehicle: { tab: VEHICLES, idKey: "Vehicle_Code", nameKey: "Registration_Number", noun: "vehicle" },
    driver: { kindTab: true, tab: DRIVERS, idKey: "Driver_Code", nameKey: "Driver_Name", noun: "driver" },
  };

  const toggleStatus = useCallback(
    async (kind, row) => {
      const { tab, idKey, nameKey } = KIND[kind];
      const next = String(row.Status || "Active").toLowerCase() === "active" ? "Inactive" : "Active";
      try {
        await setRecordStatus({ tab, id: row[idKey], status: next, user });
        toast.success(`${row[idKey]} is now ${next.toLowerCase()}`, `${row[nameKey]} — ${next === "Inactive" ? "it will not be offered in new inward entries" : "it can be used again"}.`);
        reload();
      } catch (err) {
        toast.error("Could not change the status", err.message);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reload, toast, user]
  );

  const confirmDelete = useCallback(async () => {
    if (!confirming) return;
    const { kind, row } = confirming;
    const { tab, idKey, nameKey, noun } = KIND[kind];
    const id = row[idKey];

    setRemoving(id);
    try {
      await deleteRecord({ tab, id, label: row[nameKey], user });
      setGone((prev) => [...prev, id]);
      setConfirming(null);
      toast.success(`${id} deleted`, `${row[nameKey]} has been removed and archived.`);
    } catch (err) {
      toast.error(`Could not delete the ${noun}`, err.message);
    } finally {
      setRemoving("");
    }
  }, // eslint-disable-next-line react-hooks/exhaustive-deps
  [confirming, toast, user]);

  /** The Activate / Deactivate button section 10.3 asks for, beside the rest. */
  const statusAction = (kind) => (row) => (
    <button
      type="button"
      className="btn btn--ghost btn--sm"
      onClick={() => toggleStatus(kind, row)}
      disabled={!canSave}
      title={canSave ? "Activate or deactivate" : "Saving is not connected"}
    >
      <Power size={13} aria-hidden="true" />
      {String(row.Status || "Active").toLowerCase() === "active" ? "Deactivate" : "Activate"}
    </button>
  );

  const vehicleColumns = [
    { key: "Vehicle_Code", header: "Code", render: (r) => <span className="table__code">{r.Vehicle_Code}</span> },
    { key: "Registration_Number", header: "Registration" },
    { key: "Vehicle_Type", header: "Type" },
    { key: "Vehicle_Model", header: "Model" },
    {
      key: "Insurance_Validity_Date", header: "Insurance",
      render: (r) => <ValidityCell value={r.Insurance_Validity_Date} warnDays={warnDays} />,
    },
    {
      key: "PUC_Validity_Date", header: "PUC",
      render: (r) => (
        <ValidityCell
          value={r.PUC_Validity_Date}
          warnDays={warnDays}
          notApplicable={r.Vehicle_Type === "Electric"}
        />
      ),
    },
    {
      key: "Fitness_Validity_Date", header: "Fitness",
      render: (r) => <ValidityCell value={r.Fitness_Validity_Date} warnDays={warnDays} />,
    },
    {
      key: "Registration_Validity_Date", header: "Registration Valid To",
      render: (r) => <ValidityCell value={r.Registration_Validity_Date} warnDays={warnDays} />,
    },
    { key: "Status", header: "Status", render: (r) => <Badge>{r.Status || "Active"}</Badge> },
    {
      key: "Documents_File_Id", header: "Docs", sortable: false,
      render: (r) =>
        r.Documents_File_Id ? (
          <a href={viewUrl(r.Documents_File_Id)} target="_blank" rel="noreferrer" className="u-row" style={{ gap: 4 }}>
            PDF <ExternalLink size={12} aria-hidden="true" />
          </a>
        ) : "—",
      exportValue: (r) => viewUrl(r.Documents_File_Id),
    },
    {
      key: "status_action", header: "", sortable: false, align: "center",
      exportValue: () => "",
      render: statusAction("vehicle"),
    },
    rowActionsColumn({
      idKey: "Vehicle_Code",
      canWrite: canSave,
      busyId: removing,
      labelFor: (r) => r.Vehicle_Code,
      onView: (row) => setViewing({ kind: "vehicle", row }),
      onEdit: (row) => setEditing({ kind: "vehicle", row }),
      onDelete: (row) => setConfirming({ kind: "vehicle", row }),
    }),
  ];

  const driverColumns = [
    { key: "Driver_Code", header: "Code", render: (r) => <span className="table__code">{r.Driver_Code}</span> },
    { key: "Driver_Name", header: "Driver Name" },
    { key: "Licence_Number", header: "Licence Number" },
    { key: "Contact_Number", header: "Contact" },
    {
      key: "Licence_Validity_Date", header: "Licence Valid To",
      render: (r) => <ValidityCell value={r.Licence_Validity_Date} warnDays={warnDays} />,
    },
    { key: "Status", header: "Status", render: (r) => <Badge>{r.Status || "Active"}</Badge> },
    {
      key: "Licence_File_Id", header: "Licence", sortable: false,
      render: (r) =>
        r.Licence_File_Id ? (
          <a href={viewUrl(r.Licence_File_Id)} target="_blank" rel="noreferrer" className="u-row" style={{ gap: 4 }}>
            PDF <ExternalLink size={12} aria-hidden="true" />
          </a>
        ) : "—",
      exportValue: (r) => viewUrl(r.Licence_File_Id),
    },
    {
      key: "status_action", header: "", sortable: false, align: "center",
      exportValue: () => "",
      render: statusAction("driver"),
    },
    rowActionsColumn({
      idKey: "Driver_Code",
      canWrite: canSave,
      busyId: removing,
      labelFor: (r) => r.Driver_Code,
      onView: (row) => setViewing({ kind: "driver", row }),
      onEdit: (row) => setEditing({ kind: "driver", row }),
      onDelete: (row) => setConfirming({ kind: "driver", row }),
    }),
  ];

  return (
    <>
      <PageHeader
        title="RRR on Wheels"
        description="Vehicle and driver inventories. A vehicle or driver whose documents have expired on the collection date cannot be selected in inward entry."
      />

      <Card
        title="Vehicles"
        subtitle={`${vehicles.length} in the inventory`}
        flush
        actions={
          <Button size="sm" onClick={() => setVehicleFormOpen(true)}>
            <Plus size={14} aria-hidden="true" />
            Add vehicle
          </Button>
        }
      >
        <DataTable
          columns={vehicleColumns} rows={vehicles} loading={loading} error={error}
          onRetry={reload} exportName="Vehicles" emptyText="No vehicles added yet"
        />
      </Card>

      <Modal
        open={vehicleFormOpen}
        title="Add Vehicle"
        subtitle="All fields are required"
        onClose={() => setVehicleFormOpen(false)}
        busy={saving}
        busyText="Adding vehicle — uploading the PDF and saving to the sheet…"
      >
        <VehicleForm
          existing={data.vehicles}
          onCreated={() => { setVehicleFormOpen(false); reload(); }}
          onCancel={() => setVehicleFormOpen(false)}
          onBusyChange={setSaving}
        />
      </Modal>

      <div style={{ marginTop: 20 }}>
        <Card
          title="Drivers"
          subtitle={`${drivers.length} in the inventory`}
          flush
          actions={
            <Button size="sm" onClick={() => setDriverFormOpen(true)}>
              <Plus size={14} aria-hidden="true" />
              Add driver
            </Button>
          }
        >
          <DataTable
            columns={driverColumns} rows={drivers} loading={loading} error={error}
            onRetry={reload} exportName="Drivers" emptyText="No drivers added yet"
          />
        </Card>
      </div>

      <Modal
        open={driverFormOpen}
        title="Add Driver"
        subtitle="All fields are required"
        size="md"
        onClose={() => setDriverFormOpen(false)}
        busy={saving}
        busyText="Adding driver — uploading the licence and saving to the sheet…"
      >
        <DriverForm
          existing={data.drivers}
          onCreated={() => { setDriverFormOpen(false); reload(); }}
          onCancel={() => setDriverFormOpen(false)}
          onBusyChange={setSaving}
        />
      </Modal>

      <Modal
        open={Boolean(editing)}
        title={editing ? `Edit ${editing.row[KIND[editing.kind].idKey]}` : ""}
        subtitle="The document is only replaced if you choose a new one"
        size={editing?.kind === "driver" ? "md" : "lg"}
        onClose={() => setEditing(null)}
        busy={saving}
        busyText="Saving changes to the sheet…"
      >
        {/* Keyed so switching rows rebuilds the form with the new values. */}
        {editing?.kind === "vehicle" && (
          <VehicleForm
            key={editing.row.Vehicle_Code}
            vehicle={editing.row}
            existing={data.vehicles}
            onCreated={() => { setEditing(null); reload(); }}
            onCancel={() => setEditing(null)}
            onBusyChange={setSaving}
          />
        )}
        {editing?.kind === "driver" && (
          <DriverForm
            key={editing.row.Driver_Code}
            driver={editing.row}
            existing={data.drivers}
            onCreated={() => { setEditing(null); reload(); }}
            onCancel={() => setEditing(null)}
            onBusyChange={setSaving}
          />
        )}
      </Modal>

      <Modal
        open={Boolean(viewing)}
        title={viewing ? viewing.row[KIND[viewing.kind].idKey] : ""}
        subtitle={viewing ? viewing.row[KIND[viewing.kind].nameKey] : ""}
        onClose={() => setViewing(null)}
      >
        {viewing && (
          <RecordDetails tab={KIND[viewing.kind].tab.tab} row={viewing.row} />
        )}
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
        title={confirming ? `Delete this ${KIND[confirming.kind].noun}?` : ""}
        subtitle={
          confirming
            ? `${confirming.row[KIND[confirming.kind].idKey]} — ${confirming.row[KIND[confirming.kind].nameKey]}`
            : ""
        }
        message={
          confirming
            ? `${confirming.row[KIND[confirming.kind].nameKey]} will be removed from the sheet.`
            : ""
        }
        note="A full copy is archived to Deleted_Items before the row is removed, so it can still be restored. To keep the record but stop it being used, deactivate it instead."
        confirmLabel={confirming ? `Delete ${KIND[confirming.kind].noun}` : "Delete"}
        busy={Boolean(removing)}
        busyText="Deleting and archiving…"
        onConfirm={confirmDelete}
        onCancel={() => setConfirming(null)}
      />
    </>
  );
}
