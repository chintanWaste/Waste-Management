import { useMemo, useState } from "react";
import { Truck } from "lucide-react";
import Button from "../../components/common/Button";
import Card from "../../components/common/Card";
import { Banner, EmptyState } from "../../components/common/States";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { active } from "../../hooks/useSheets";
import { createMmrfDispatch } from "../../services/dispatchService";
import { kg, num, today } from "../../utils/format";
import { mmrfAvailableOn } from "../../utils/stock";
import DispatchHeaderFields from "./DispatchHeaderFields";
import DispatchList from "./DispatchList";

const EMPTY = {
  Dispatch_Date: today(), Area: "", Vendor_Code: "", Purpose: "", Financials: "",
};

/**
 * Section 14.2 — MMRF dispatch.
 *
 * Totals only, one dispatch entry per centre. A row can be dispatched on its
 * own, or several rows filled and dispatched together. MMRF dispatches are not
 * tracked on the Certificates page.
 */
export default function MmrfDispatchTab({ data, reload, loading, error }) {
  const { user } = useAuth();
  const toast = useToast();

  const [values, setValues] = useState(EMPTY);
  const [amounts, setAmounts] = useState({});
  const [saving, setSaving] = useState(false);

  const centres = useMemo(() => {
    const list = active(data.mmrfs).filter((m) => !values.Area || m.Area === values.Area);
    return list.map((m) => ({
      code: m.MMRF_Code,
      name: m.MMRF_Name,
      area: m.Area,
      available: mmrfAvailableOn({
        mmrfCode: m.MMRF_Code,
        dispatchDate: values.Dispatch_Date,
        inwardMmrf: data.inwardMmrf,
        dispatch: data.dispatch,
      }),
    }));
  }, [data.mmrfs, data.inwardMmrf, data.dispatch, values.Area, values.Dispatch_Date]);

  const rows = centres.map((c) => ({ ...c, quantityKg: Number(amounts[c.code]) || 0 }));
  const filled = rows.filter((r) => r.quantityKg > 0);
  const overdrawn = filled.filter((r) => r.quantityKg > r.available + 0.005);
  const total = filled.reduce((sum, r) => sum + r.quantityKg, 0);

  const headerReady =
    values.Dispatch_Date && values.Area && values.Vendor_Code &&
    values.Purpose && values.Financials;

  const dispatchRows = async (chosen) => {
    setSaving(true);
    try {
      const codes = await createMmrfDispatch({ values, rows: chosen, user });
      toast.success(
        codes.length === 1 ? `Dispatch ${codes[0]} created` : `${codes.length} dispatches created`,
        `${kg(chosen.reduce((s, r) => s + r.quantityKg, 0))} to ${values.Vendor_Code}.`
      );
      setAmounts({});
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
        title="Dispatch MMRF Stock"
        subtitle="Recorded as totals per centre — MMRF waste has no categories and is not tracked for certificates"
      >
        <DispatchHeaderFields values={values} onChange={setValues} vendors={data.vendors} showArea />

        {!values.Area ? (
          <EmptyState title="Choose an Area" text="The active centres of that area will be listed here." />
        ) : centres.length === 0 ? (
          <EmptyState title="No Active Centres" text={`No MMRF / RRR Centre is active in ${values.Area}.`} />
        ) : (
          <div className="formsection">
            <div className="formsection__title">Available stock on {values.Dispatch_Date}</div>
            <div className="tablewrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>MMRF name</th>
                    <th className="u-right">Available (kg)</th>
                    <th style={{ width: 170 }}>Quantity to dispatch (kg)</th>
                    <th style={{ width: 120 }} />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const over = r.quantityKg > r.available + 0.005;
                    return (
                      <tr key={r.code}>
                        <td>
                          <span className="table__code">{r.code}</span> {r.name}
                        </td>
                        <td className="u-right u-mono">{num(r.available, 2)}</td>
                        <td>
                          <input
                            type="number" min="0" max={r.available} step="0.01"
                            className={`input ${over ? "input--error" : ""}`}
                            style={{ textAlign: "right" }} placeholder="0"
                            disabled={r.available <= 0}
                            value={amounts[r.code] ?? ""}
                            onChange={(e) => setAmounts((a) => ({ ...a, [r.code]: e.target.value }))}
                          />
                        </td>
                        <td>
                          <Button
                            size="sm" variant="secondary"
                            disabled={!headerReady || r.quantityKg <= 0 || over || saving}
                            onClick={() => dispatchRows([r])}
                          >
                            Dispatch
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {overdrawn.length > 0 && (
          <Banner tone="danger">
            {overdrawn.length === 1
              ? `${overdrawn[0].name} exceeds the available ${num(overdrawn[0].available, 2)} kg.`
              : `${overdrawn.length} centres exceed the stock available.`}{" "}
            Stock can never go negative.
          </Banner>
        )}

        {values.Area && centres.length > 0 && (
          <div className="formactions">
            <span className="u-grow u-small u-muted">
              {filled.length} row{filled.length === 1 ? "" : "s"} filled · total {kg(total)}
            </span>
            <Button
              disabled={!headerReady || filled.length === 0 || overdrawn.length > 0 || saving}
              onClick={() => dispatchRows(filled)}
            >
              <Truck size={15} aria-hidden="true" />
              {saving ? "Dispatching…" : "Dispatch all filled rows"}
            </Button>
          </div>
        )}
      </Card>

      <div style={{ marginTop: 16 }}>
        <DispatchList
          sourceType="MMRF"
          dispatch={data.dispatch}
          dispatchLines={data.dispatchLines}
          vendors={data.vendors}
          mmrfs={data.mmrfs}
          loading={loading}
          error={error}
          reload={reload}
        />
      </div>
    </>
  );
}
