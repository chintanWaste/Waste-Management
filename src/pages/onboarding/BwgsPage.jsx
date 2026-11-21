import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Plus } from "lucide-react";
import Badge from "../../components/common/Badge";
import Button from "../../components/common/Button";
import Card from "../../components/common/Card";
import DataTable from "../../components/common/DataTable";
import Modal from "../../components/common/Modal";
import PageHeader from "../../components/common/PageHeader";
import { viewUrl } from "../../services/drive";
import { loadBwgDirectory } from "../../services/bwgService";
import { date } from "../../utils/format";
import BwgForm from "./BwgForm";

/** Sections 8.1–8.2 — Create BWG form at the top, BWG directory below. */
export default function BwgsPage() {
  const [formOpen, setFormOpen] = useState(false);
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
    },
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
      >
        <BwgForm
          onCreated={() => { setFormOpen(false); load(); }}
          onCancel={() => setFormOpen(false)}
        />
      </Modal>

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
