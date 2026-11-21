import { Plus } from "lucide-react";
import { useMemo } from "react";
import Badge from "../../components/common/Badge";
import Card from "../../components/common/Card";
import DataTable from "../../components/common/DataTable";
import PageHeader from "../../components/common/PageHeader";
import { WASTE_CATEGORIES } from "../../config/driveSchema";
import { useSheetData } from "../../hooks/useSheetData";

/** Section 17.3 — the category master, read live from the Waste_Categories tab. */
export default function WasteCategoriesPage() {
  const { rows, loading, error, reload } = useSheetData(WASTE_CATEGORIES.tab);

  const data = useMemo(
    () =>
      rows.map((r) => ({
        no: r.Serial_No,
        stream: r.Waste_Stream,
        group: r.Material_Group,
        category: r.Waste_Category,
        unit: r.Unit,
        certificate: r.Certificate_Requirement,
        status: r.Status || "Active",
      })),
    [rows]
  );

  const columns = [
    { key: "no", header: "S. No", align: "right" },
    { key: "stream", header: "Stream" },
    { key: "group", header: "Material Group" },
    { key: "category", header: "Waste Category" },
    { key: "unit", header: "Unit" },
    {
      key: "certificate",
      header: "Certificate",
      render: (r) =>
        r.certificate ? (
          <Badge tone={r.certificate === "Required" ? "info" : "muted"}>
            {r.certificate}
          </Badge>
        ) : "—",
    },
    { key: "status", header: "Status", render: (r) => <Badge>{r.status}</Badge> },
  ];

  const streams = new Set(data.map((d) => d.stream).filter(Boolean));
  const groups = new Set(data.map((d) => d.group).filter(Boolean));
  const required = data.filter((d) => d.certificate === "Required").length;

  /** A dash rather than a zero while the tab is empty or still loading. */
  const tile = (value) => (loading || !data.length ? "—" : value);

  return (
    <>
      <PageHeader
        title="Waste Categories"
        description="The single category master used across inward entry, stock, dispatch, certificates, the dashboard and reports. A category already used in entries cannot be deleted — deactivate it instead."
        actions={
          <button className="btn btn--primary">
            <Plus size={15} aria-hidden="true" />
            Add category
          </button>
        }
      />

      <div className="stats" style={{ marginBottom: 16 }}>
        <div className="stat">
          <div className="stat__label">Categories</div>
          <div className="stat__value">{tile(data.length)}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Waste streams</div>
          <div className="stat__value">{tile(streams.size)}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Material groups</div>
          <div className="stat__value">{tile(groups.size)}</div>
        </div>
        <div className="stat stat--info">
          <div className="stat__label">Certificate required</div>
          <div className="stat__value">{tile(required)}</div>
        </div>
      </div>

      <Card flush>
        <DataTable
          columns={columns}
          rows={data}
          loading={loading}
          error={error}
          onRetry={reload}
          exportName="Waste_Categories"
          emptyText="The Waste_Categories tab is empty. Import the template into the Google Sheet to load the 60 categories."
        />
      </Card>
    </>
  );
}
