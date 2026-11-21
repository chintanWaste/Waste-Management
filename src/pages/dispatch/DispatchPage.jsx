import { useMemo, useState } from "react";
import PageHeader from "../../components/common/PageHeader";
import Tabs from "../../components/common/Tabs";
import { Banner } from "../../components/common/States";
import { SOURCE_TYPE_LABEL } from "../../config/appConfig";
import { useAuth } from "../../context/AuthContext";
import { useSheets } from "../../hooks/useSheets";
import CategoryDispatchTab from "./CategoryDispatchTab";
import MmrfDispatchTab from "./MmrfDispatchTab";

/**
 * Section 14 — dispatch.
 * Four tabs, each drawing only on its own source type's stock.
 */
const SOURCES = ["MMRF", "SPECIAL", "RRR", "BWG"];

export default function DispatchPage() {
  const { canUseSource, isSuperAdmin, user } = useAuth();

  const { data, loading, error, reload } = useSheets([
    "vendors", "mmrfs", "inwardMmrf",
    "entryCategories", "dispatch", "dispatchLines",
  ]);

  const sources = useMemo(() => SOURCES.filter((s) => canUseSource(s)), [canUseSource]);
  const [activeSource, setActiveSource] = useState(sources[0] || "MMRF");
  const current = sources.includes(activeSource) ? activeSource : sources[0];

  return (
    <>
      <PageHeader
        title="Dispatch"
        description="Send waste to a vendor. Available stock counts inward up to the day before the dispatch date, minus dispatches already made — stock can never go negative."
      />

      {!isSuperAdmin && (
        <div style={{ marginBottom: 16 }}>
          <Banner tone="info">
            Showing only your assigned sources: {user?.sources?.join(", ") || "none"}.
          </Banner>
        </div>
      )}

      {sources.length === 0 ? (
        <Banner tone="warn">
          You have no source types assigned, so there is nothing to dispatch here.
          Ask a Super Admin to assign your sources.
        </Banner>
      ) : (
        <>
          <Tabs
            tabs={sources.map((s) => ({ key: s, label: SOURCE_TYPE_LABEL[s] }))}
            active={current}
            onChange={setActiveSource}
          />

          {current === "MMRF" ? (
            <MmrfDispatchTab data={data} reload={reload} loading={loading} error={error} />
          ) : (
            <CategoryDispatchTab
              key={current}
              sourceType={current}
              label={SOURCE_TYPE_LABEL[current]}
              data={data}
              reload={reload}
              loading={loading}
              error={error}
            />
          )}
        </>
      )}
    </>
  );
}
