import { useState } from "react";
import { ExternalLink, Plus } from "lucide-react";
import Badge from "../../components/common/Badge";
import Button from "../../components/common/Button";
import Card from "../../components/common/Card";
import DataTable from "../../components/common/DataTable";
import Modal from "../../components/common/Modal";
import PageHeader from "../../components/common/PageHeader";
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
  const warnDays = number(SETTING.documentExpiryWarnDays, 30);
  const { data, loading, error, reload } = useSheets(["vehicles", "drivers"]);

  const [vehicleFormOpen, setVehicleFormOpen] = useState(false);
  const [driverFormOpen, setDriverFormOpen] = useState(false);

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
    },
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
    },
  ];

  return (
    <>
      <PageHeader
        title="RRR on Wheels"
        description="Vehicle and driver inventories. A vehicle or driver whose documents have expired on the collection date cannot be selected in inward entry."
      />

      <Card
        title="Vehicles"
        subtitle={`${data.vehicles.length} in the inventory`}
        flush
        actions={
          <Button size="sm" onClick={() => setVehicleFormOpen(true)}>
            <Plus size={14} aria-hidden="true" />
            Add vehicle
          </Button>
        }
      >
        <DataTable
          columns={vehicleColumns} rows={data.vehicles} loading={loading} error={error}
          onRetry={reload} exportName="Vehicles" emptyText="No vehicles added yet"
        />
      </Card>

            <Modal
        open={vehicleFormOpen}
        title="Add Vehicle"
        subtitle="All fields are required"
        onClose={() => setVehicleFormOpen(false)}
      >
        <VehicleForm
          existing={data.vehicles}
          onCreated={() => { setVehicleFormOpen(false); reload(); }}
          onCancel={() => setVehicleFormOpen(false)}
        />
      </Modal>

      <div style={{ marginTop: 20 }}>
        <Card
          title="Drivers"
          subtitle={`${data.drivers.length} in the inventory`}
          flush
          actions={
            <Button size="sm" onClick={() => setDriverFormOpen(true)}>
              <Plus size={14} aria-hidden="true" />
              Add driver
            </Button>
          }
        >
          <DataTable
            columns={driverColumns} rows={data.drivers} loading={loading} error={error}
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
      >
        <DriverForm
          existing={data.drivers}
          onCreated={() => { setDriverFormOpen(false); reload(); }}
          onCancel={() => setDriverFormOpen(false)}
        />
      </Modal>
    </>
  );
}
