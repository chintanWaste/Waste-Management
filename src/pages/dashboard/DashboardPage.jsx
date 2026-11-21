import { FileDown, Plug, RotateCw } from "lucide-react";
import { useState } from "react";
import PageHeader from "../../components/common/PageHeader";
import { Banner, ErrorState } from "../../components/common/States";
import AlertsPanel from "../../components/dashboard/AlertsPanel";
import CollectionTrendChart from "../../components/dashboard/CollectionTrendChart";
import DashboardFilters from "../../components/dashboard/DashboardFilters";
import SourceMixChart from "../../components/dashboard/SourceMixChart";
import SummaryCards from "../../components/dashboard/SummaryCards";
import TopBwgChart from "../../components/dashboard/TopBwgChart";
import WasteStreamChart from "../../components/dashboard/WasteStreamChart";
import { isDriveConfigured } from "../../config/driveSchema";
import { useAuth } from "../../context/AuthContext";
import { useDashboardData } from "../../hooks/useDashboardData";
import { periodLabel } from "../../utils/period";

const INITIAL_FILTERS = {
  period: "this-month", area: "", source: "", stream: "", from: "", to: "",
};

/** Every figure here is derived from the Google Sheet — nothing is hard-coded. */
export default function DashboardPage() {
  const { user, isSuperAdmin } = useAuth();
  const [filters, setFilters] = useState(INITIAL_FILTERS);

  const { summary, charts, alerts, range, loading, error, reload } =
    useDashboardData(filters);

  if (!isDriveConfigured()) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <Banner tone="warn" icon={Plug}>
          No Google Sheet is connected. Add <code>VITE_SHEET_ID</code> to{" "}
          <code>app/.env</code> and reload.
        </Banner>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={`Good day, ${user?.name?.split(" ")[0] || "there"}`}
        description={
          isSuperAdmin
            ? `Collection, stock, dispatch and certificates · ${periodLabel(range)}`
            : `Your assigned sources: ${user?.sources?.join(", ") || "—"}`
        }
        actions={
          <>
            <button className="btn btn--secondary" onClick={reload} disabled={loading}>
              <RotateCw size={15} aria-hidden="true" />
              {loading ? "Refreshing…" : "Refresh"}
            </button>
            <button className="btn btn--secondary">
              <FileDown size={15} aria-hidden="true" />
              Download summary PDF
            </button>
          </>
        }
      />

      {error && (
        <div style={{ marginBottom: 16 }}>
          <ErrorState error={error} onRetry={reload} />
        </div>
      )}

      <DashboardFilters
        value={filters}
        onChange={setFilters}
        allowedSources={isSuperAdmin ? null : user?.sources}
      />

      <SummaryCards s={summary} loading={loading} />

      <div className="grid grid--2" style={{ marginTop: 16 }}>
        <CollectionTrendChart data={charts.trend} />
        <SourceMixChart data={charts.sourceMix} />
      </div>

      <div className="grid grid--2" style={{ marginTop: 16 }}>
        <WasteStreamChart data={charts.streams} />
        <AlertsPanel alerts={alerts} canClose={isSuperAdmin} />
      </div>

      <div style={{ marginTop: 16 }}>
        <TopBwgChart data={charts.topBwgs} />
      </div>
    </>
  );
}
