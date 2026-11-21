import { useMemo, useState } from "react";
import Card from "../../components/common/Card";
import ExportMenu from "../../components/common/ExportMenu";
import DataTable from "../../components/common/DataTable";
import { SelectInput } from "../../components/common/Field";
import PageHeader from "../../components/common/PageHeader";
import Tabs from "../../components/common/Tabs";
import { Banner, ErrorState, SkeletonRows } from "../../components/common/States";
import { SETTING, SOURCE_TYPE_LABEL } from "../../config/appConfig";
import { useAuth } from "../../context/AuthContext";
import { useSettings } from "../../context/SettingsContext";
import { useSheets } from "../../hooks/useSheets";
import { categoryStock, groupStock, mmrfStock, uncategorised } from "../../utils/stock";
import { kg, toInputDate } from "../../utils/format";
import StockTable from "./StockTable";

/** Which inward tab feeds each categorised source. */
const SOURCE_INWARD = {
  BWG: { key: "bwgCharacterisation", amount: "Total_Collected_Kg", id: "Characterisation_Id" },
  RRR: { key: "inwardRrr", amount: "Total_Waste_Collected_Kg", id: "Entry_Id" },
  SPECIAL: { key: "inwardSpecial", amount: "Total_Waste_Collected_Kg", id: "Entry_Code" },
};

const startOfMonth = () => {
  const d = new Date();
  return toInputDate(new Date(d.getFullYear(), d.getMonth(), 1));
};

/** Section 13 — stock by source type, stream, material group and category. */
export default function StockPage() {
  const { canUseSource, isSuperAdmin, user } = useAuth();
  const { list } = useSettings();

  const { data, loading, error, reload } = useSheets([
    "entryCategories", "dispatch", "dispatchLines",
    "inwardMmrf", "inwardRrr", "inwardSpecial", "bwgCharacterisation", "mmrfs",
  ]);

  const sources = ["BWG", "RRR", "MMRF", "SPECIAL"].filter((s) => canUseSource(s));
  const [activeSource, setActiveSource] = useState(sources[0] || "BWG");
  const [from, setFrom] = useState(startOfMonth());
  const [to, setTo] = useState(toInputDate(new Date()));

  const isMmrf = activeSource === "MMRF";

  const categoryRows = useMemo(() => {
    if (isMmrf) return [];
    return categoryStock({
      sourceType: activeSource,
      entryCategories: data.entryCategories,
      dispatch: data.dispatch,
      dispatchLines: data.dispatchLines,
      from, to,
    });
  }, [isMmrf, activeSource, data, from, to]);

  const streams = useMemo(() => groupStock(categoryRows), [categoryRows]);

  const uncategorisedRow = useMemo(() => {
    if (isMmrf) return null;
    const source = SOURCE_INWARD[activeSource];
    if (!source) return null;
    return uncategorised({
      sourceType: activeSource,
      inwardRows: data[source.key] || [],
      amountColumn: source.amount,
      idColumn: source.id,
      entryCategories: data.entryCategories,
      from, to,
    });
  }, [isMmrf, activeSource, data, from, to]);

  const mmrfRows = useMemo(() => {
    if (!isMmrf) return [];
    const names = Object.fromEntries(data.mmrfs.map((m) => [m.MMRF_Code, m.MMRF_Name]));
    return mmrfStock({ inwardMmrf: data.inwardMmrf, dispatch: data.dispatch, from, to })
      .map((r) => ({ ...r, name: names[r.code] || r.code }));
  }, [isMmrf, data, from, to]);

  /** Flatten the tree into export rows: stream, then material group, then category. */
  const exportRows = useMemo(() => {
    if (isMmrf) {
      return mmrfRows.map((r) => ({
        Level: "MMRF", Name: r.name, Opening: r.opening,
        Collected: r.collected, Dispatched: r.dispatched, Closing: r.closing,
      }));
    }

    const out = [];
    for (const stream of streams) {
      out.push({ Level: "Stream", Name: stream.name, Opening: stream.opening, Collected: stream.collected, Dispatched: stream.dispatched, Closing: stream.closing });
      for (const group of stream.groups) {
        out.push({ Level: "Material group", Name: group.name, Opening: group.opening, Collected: group.collected, Dispatched: group.dispatched, Closing: group.closing });
        for (const item of group.items) {
          out.push({ Level: "Category", Name: item.name, Opening: item.opening, Collected: item.collected, Dispatched: item.dispatched, Closing: item.closing });
        }
      }
    }
    if (uncategorisedRow?.closing) {
      out.push({ Level: "Uncategorised", Name: "", Opening: uncategorisedRow.opening, Collected: uncategorisedRow.collected, Dispatched: 0, Closing: uncategorisedRow.closing });
    }
    return out;
  }, [isMmrf, mmrfRows, streams, uncategorisedRow]);

  const exportColumns = [
    { key: "Level", header: "Level" },
    { key: "Name", header: "Name" },
    { key: "Opening", header: "Opening (kg)" },
    { key: "Collected", header: "Collected (kg)" },
    { key: "Dispatched", header: "Dispatched (kg)" },
    { key: "Closing", header: "Closing (kg)" },
  ];

  return (
    <>
      <PageHeader
        title="Stock"
        description="Opening, collected, dispatched and closing stock. Read-only — stock changes only through inward and dispatch entries, and is never mixed across source types."
        actions={
          <ExportMenu
            size="md"
            fileName={`Stock_${activeSource}`}
            title={`Stock report — ${SOURCE_TYPE_LABEL[activeSource]}`}
            meta={[`Period: ${from} to ${to}`, `Source type: ${SOURCE_TYPE_LABEL[activeSource]}`]}
            columns={exportColumns}
            rows={exportRows}
          />
        }
      />

      {!isSuperAdmin && (
        <div style={{ marginBottom: 16 }}>
          <Banner tone="info">
            Showing only your assigned sources: {user?.sources?.join(", ") || "none"}.
          </Banner>
        </div>
      )}

      <Tabs
        tabs={sources.map((s) => ({ key: s, label: SOURCE_TYPE_LABEL[s] }))}
        active={activeSource}
        onChange={setActiveSource}
      />

      <div className="filterbar">
        <div className="field">
          <label className="field__label">From</label>
          <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="field">
          <label className="field__label">To</label>
          <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="u-grow" />
        <button className="btn btn--secondary" onClick={reload} disabled={loading}>
          Refresh
        </button>
      </div>

      <Card
        title={`${SOURCE_TYPE_LABEL[activeSource]} stock`}
        subtitle={isMmrf ? "Totals per centre — MMRF waste has no categories" : "Expand a stream to see its material groups and categories"}
        flush
      >
        {loading ? (
          <SkeletonRows rows={6} />
        ) : error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : isMmrf ? (
          <DataTable
            rows={mmrfRows}
            exportName={`Stock_MMRF_${from}_to_${to}`}
            emptyText="No MMRF stock in this period"
            columns={[
              { key: "code", header: "Code", render: (r) => <span className="table__code">{r.code}</span> },
              { key: "name", header: "Centre" },
              { key: "opening", header: "Opening", align: "right", render: (r) => kg(r.opening) },
              { key: "collected", header: "Collected", align: "right", render: (r) => kg(r.collected) },
              { key: "dispatched", header: "Dispatched", align: "right", render: (r) => kg(r.dispatched) },
              { key: "closing", header: "Closing", align: "right", render: (r) => <b>{kg(r.closing)}</b> },
            ]}
          />
        ) : (
          <StockTable streams={streams} uncategorisedRow={uncategorisedRow} />
        )}
      </Card>
    </>
  );
}
