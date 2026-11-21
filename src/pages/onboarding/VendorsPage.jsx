import { ExternalLink, Plug, Plus } from "lucide-react";
import { useState } from "react";
import Badge from "../../components/common/Badge";
import Button from "../../components/common/Button";
import Card from "../../components/common/Card";
import DataTable from "../../components/common/DataTable";
import Modal from "../../components/common/Modal";
import PageHeader from "../../components/common/PageHeader";
import { Banner } from "../../components/common/States";
import { VENDORS, isDriveConfigured } from "../../config/driveSchema";
import { useSheetData } from "../../hooks/useSheetData";
import { viewUrl } from "../../services/drive";
import { date } from "../../utils/format";
import VendorForm from "./VendorForm";

/** Sections 7.1–7.3 — Create vendor form at the top, directory below. */
export default function VendorsPage() {
  const connected = isDriveConfigured();
  const [formOpen, setFormOpen] = useState(false);
  const { rows, loading, error, reload } = useSheetData(VENDORS.tab, { enabled: connected });

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
      render: (r) =>
        r.Documents_File_Id ? (
          <a href={viewUrl(r.Documents_File_Id)} target="_blank" rel="noreferrer" className="u-row" style={{ gap: 4 }}>
            PDF <ExternalLink size={12} aria-hidden="true" />
          </a>
        ) : "—",
    },
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
      >
        <VendorForm
          onCreated={() => { setFormOpen(false); reload(); }}
          onCancel={() => setFormOpen(false)}
        />
      </Modal>

      {!connected && (
        <div style={{ marginBottom: 16 }}>
          <Banner tone="warn" icon={Plug}>
            Connect the Google Sheet (<code>VITE_SHEET_ID</code>) to list vendors here.
            The directory reads the <code>Vendors</code> tab.
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
