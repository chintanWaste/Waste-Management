import { useMemo, useState } from "react";
import { Truck } from "lucide-react";
import Button from "../../components/common/Button";
import Card from "../../components/common/Card";
import { SearchBox } from "../../components/common/Field";
import { Banner, EmptyState } from "../../components/common/States";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useCategories } from "../../hooks/useCategories";
import { createCategoryDispatch } from "../../services/dispatchService";
import { kg, num, today } from "../../utils/format";
import { availableOn } from "../../utils/stock";
import DispatchHeaderFields from "./DispatchHeaderFields";
import DispatchList from "./DispatchList";

const EMPTY = {
  Dispatch_Date: today(), Vendor_Code: "", Purpose: "", Financials: "", Area: "",
};

/**
 * Dispatch of categorised stock — Special collection, RRR on Wheels and BWG
 * (specification sections 14.3–14.5). BWG stock is pooled across all collection
 * vendors, and the buying vendor can be any vendor.
 */
export default function CategoryDispatchTab({ sourceType, label, data, reload, loading, error }) {
  const { user } = useAuth();
  const toast = useToast();
  const { byId } = useCategories();

  const [values, setValues] = useState(EMPTY);
  const [amounts, setAmounts] = useState({});
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);

  /** Stock available on the chosen dispatch date (section 5.1). */
  const available = useMemo(
    () =>
      availableOn({
        sourceType,
        dispatchDate: values.Dispatch_Date,
        entryCategories: data.entryCategories,
        dispatch: data.dispatch,
        dispatchLines: data.dispatchLines,
      }),
    [sourceType, values.Dispatch_Date, data]
  );

  const stockRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return Object.entries(available)
      .map(([categoryId, kgAvailable]) => {
        const category = byId[categoryId];
        return {
          categoryId,
          name: category?.name || categoryId,
          group: category?.group || "Unspecified",
          stream: category?.stream || "Unspecified",
          certificate: category?.certificate || "",
          available: kgAvailable,
        };
      })
      .filter((r) => !q || r.name.toLowerCase().includes(q))
      .sort((a, b) => a.stream.localeCompare(b.stream) || a.group.localeCompare(b.group));
  }, [available, byId, query]);

  const lines = stockRows
    .map((r) => ({ ...r, quantityKg: Number(amounts[r.categoryId]) || 0 }))
    .filter((r) => r.quantityKg > 0);

  const total = lines.reduce((sum, l) => sum + l.quantityKg, 0);
  const overdrawn = lines.filter((l) => l.quantityKg > l.available + 0.005);

  const ready =
    values.Dispatch_Date && values.Vendor_Code && values.Purpose && values.Financials &&
    lines.length > 0 && overdrawn.length === 0;

  const submit = async () => {
    setSaving(true);
    try {
      const { code, totalKg } = await createCategoryDispatch({
        sourceType, values, lines, user,
      });
      toast.success(`Dispatch ${code} created`, `${kg(totalKg)} to ${values.Vendor_Code}.`);
      setAmounts({});
      setValues({ ...EMPTY, Dispatch_Date: values.Dispatch_Date });
      reload();
    } catch (err) {
      toast.error("Could not create the dispatch", err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card
        title={`Dispatch ${label} stock`}
        subtitle={
          sourceType === "BWG"
            ? "BWG stock is pooled across all collection vendors — the buying vendor can be any vendor"
            : `Only ${label} stock can be dispatched here`
        }
      >
        <DispatchHeaderFields values={values} onChange={setValues} vendors={data.vendors} />

        <div className="formsection">
          <div className="u-row-between u-wrap" style={{ marginBottom: 12 }}>
            <div className="formsection__title" style={{ margin: 0, border: "none", padding: 0 }}>
              Available stock on {values.Dispatch_Date}
            </div>
            <SearchBox value={query} onChange={setQuery} placeholder="Find a category…" />
          </div>

          {stockRows.length === 0 ? (
            <EmptyState
              title="No Stock Available"
              text={`Nothing categorised and undispatched is held in ${label} stock on this date. Stock counts inward up to the day before the dispatch date.`}
            />
          ) : (
            <div className="tablewrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Material group</th>
                    <th className="u-right">Available (kg)</th>
                    <th style={{ width: 170 }}>Quantity to dispatch (kg)</th>
                  </tr>
                </thead>
                <tbody>
                  {stockRows.map((r) => {
                    const entered = Number(amounts[r.categoryId]) || 0;
                    const over = entered > r.available + 0.005;
                    return (
                      <tr key={r.categoryId}>
                        <td>
                          {r.name}
                          {r.certificate === "Required" && (
                            <span className="badge badge--info" style={{ marginLeft: 8 }}>Certificate</span>
                          )}
                        </td>
                        <td className="u-small u-muted">{r.stream} · {r.group}</td>
                        <td className="u-right u-mono">{num(r.available, 2)}</td>
                        <td>
                          <input
                            type="number" min="0" max={r.available} step="0.01"
                            className={`input ${over ? "input--error" : ""}`}
                            style={{ textAlign: "right" }} placeholder="0"
                            value={amounts[r.categoryId] ?? ""}
                            onChange={(e) =>
                              setAmounts((a) => ({ ...a, [r.categoryId]: e.target.value }))
                            }
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {overdrawn.length > 0 && (
          <Banner tone="danger">
            {overdrawn.length === 1
              ? `${overdrawn[0].name} exceeds the available ${num(overdrawn[0].available, 2)} kg.`
              : `${overdrawn.length} categories exceed the stock available.`}{" "}
            Stock can never go negative.
          </Banner>
        )}

        {stockRows.length > 0 && (
          <div className="formactions">
            <span className="u-grow u-small u-muted">
              Total to dispatch: <b>{kg(total)}</b> across {lines.length} categor
              {lines.length === 1 ? "y" : "ies"}
            </span>
            <Button onClick={submit} disabled={!ready || saving}>
              <Truck size={15} aria-hidden="true" />
              {saving ? "Dispatching…" : "Submit dispatch"}
            </Button>
          </div>
        )}
      </Card>

      <div style={{ marginTop: 16 }}>
        <DispatchList
          sourceType={sourceType}
          dispatch={data.dispatch}
          dispatchLines={data.dispatchLines}
          vendors={data.vendors}
          loading={loading}
          error={error}
          reload={reload}
        />
      </div>
    </>
  );
}
