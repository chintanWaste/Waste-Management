import { useMemo, useState } from "react";
import { Eye, X } from "lucide-react";
import Badge from "../../components/common/Badge";
import Card from "../../components/common/Card";
import DataTable from "../../components/common/DataTable";
import { EmptyState } from "../../components/common/States";
import { date, kg } from "../../utils/format";

/** Section 14.6 — the dispatch list of one tab, with its category lines. */
export default function DispatchList({
  sourceType, dispatch, dispatchLines, vendors, mmrfs = [], loading, error, reload,
}) {
  const [viewing, setViewing] = useState(null);

  const vendorName = useMemo(
    () => Object.fromEntries(vendors.map((v) => [v.Vendor_Code, v.Vendor_Name])),
    [vendors]
  );
  const mmrfName = useMemo(
    () => Object.fromEntries(mmrfs.map((m) => [m.MMRF_Code, m.MMRF_Name])),
    [mmrfs]
  );

  const rows = useMemo(
    () =>
      dispatch
        .filter(
          (d) =>
            d.Source_Type === sourceType &&
            String(d.Status || "").toLowerCase() !== "deleted"
        )
        .sort((a, b) => String(b.Dispatch_Date).localeCompare(String(a.Dispatch_Date))),
    [dispatch, sourceType]
  );

  const linesOf = (code) => dispatchLines.filter((l) => l.Dispatch_Code === code);

  return (
    <>
      <Card title="Dispatch Entries" flush>
        <DataTable
          rows={rows} loading={loading} error={error} onRetry={reload}
          exportName={`Dispatch_${sourceType}`} emptyText="No dispatches yet"
          columns={[
            {
              key: "Dispatch_Code", header: "Code",
              render: (r) => <span className="table__code">{r.Dispatch_Code}</span>,
            },
            { key: "Dispatch_Date", header: "Date", render: (r) => date(r.Dispatch_Date) },
            ...(sourceType === "MMRF"
              ? [{
                  key: "Source_Ref", header: "Centre",
                  render: (r) => mmrfName[r.Source_Ref] || r.Source_Ref || "—",
                }]
              : []),
            {
              key: "Vendor_Code", header: "Vendor",
              render: (r) => `${r.Vendor_Code} — ${vendorName[r.Vendor_Code] || "Unknown"}`,
            },
            { key: "Purpose", header: "Purpose" },
            {
              key: "Total_Quantity_Kg", header: "Total", align: "right",
              render: (r) => kg(r.Total_Quantity_Kg),
            },
            { key: "Financials", header: "Financials" },
            { key: "Status", header: "Status", render: (r) => <Badge>{r.Status || "Active"}</Badge> },
            ...(sourceType === "MMRF"
              ? []
              : [{
                  key: "actions", header: "", sortable: false,
                  render: (r) => (
                    <button className="btn btn--ghost btn--sm" onClick={() => setViewing(r)}>
                      <Eye size={13} aria-hidden="true" />
                      Lines
                    </button>
                  ),
                }]),
          ]}
        />
      </Card>

      {viewing && (
        <>
          <div className="scrim scrim--show" onClick={() => setViewing(null)} />
          <div className="drawer" role="dialog" aria-label={`Lines of ${viewing.Dispatch_Code}`}>
            <div className="drawer__head">
              <div>
                <div className="card__title">{viewing.Dispatch_Code}</div>
                <div className="u-small u-muted">
                  {date(viewing.Dispatch_Date)} · {viewing.Purpose} · {kg(viewing.Total_Quantity_Kg)}
                </div>
              </div>
              <button className="toast__close" onClick={() => setViewing(null)} aria-label="Close">
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            <div className="drawer__body">
              {linesOf(viewing.Dispatch_Code).length === 0 ? (
                <EmptyState title="No Category Lines" text="This dispatch was recorded as a total only." />
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th className="u-right">Quantity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linesOf(viewing.Dispatch_Code).map((l) => (
                      <tr key={l.Line_Id}>
                        <td>
                          {l.Waste_Category}
                          <div className="u-small u-muted">{l.Waste_Stream} · {l.Material_Group}</div>
                        </td>
                        <td className="u-right u-mono">{kg(l.Quantity_Kg)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
