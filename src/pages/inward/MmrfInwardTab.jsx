import { useMemo, useState } from "react";
import Badge from "../../components/common/Badge";
import Button from "../../components/common/Button";
import Card from "../../components/common/Card";
import DataTable from "../../components/common/DataTable";
import { SelectInput } from "../../components/common/Field";
import { Banner, EmptyState } from "../../components/common/States";
import { SETTING } from "../../config/appConfig";
import { useAuth } from "../../context/AuthContext";
import { useSettings } from "../../context/SettingsContext";
import { useToast } from "../../context/ToastContext";
import { active, useSheets } from "../../hooks/useSheets";
import { saveMmrfInward } from "../../services/inwardService";
import { date, kg, num, today } from "../../utils/format";
import { useCollectionDate } from "./useCollectionDate";

/**
 * Section 12.2 — MMRF inward.
 * One entry per MMRF per date, recorded as a total only: no categories,
 * no photos, and not tracked for certificates.
 */
export default function MmrfInwardTab() {
  const { user } = useAuth();
  const { list } = useSettings();
  const toast = useToast();
  const { data, loading, error, reload } = useSheets(["mmrfs", "inwardMmrf"]);

  const [area, setArea] = useState("");
  const { value: collectionDate, setValue: setCollectionDate, max, min, error: dateError } =
    useCollectionDate();
  const [amounts, setAmounts] = useState({});
  const [saving, setSaving] = useState(false);

  const centres = useMemo(
    () => active(data.mmrfs).filter((m) => !area || m.Area === area),
    [data.mmrfs, area]
  );

  const existing = useMemo(
    () =>
      data.inwardMmrf.find(
        (r) => r.Collection_Date === collectionDate && r.Area === area
      ),
    [data.inwardMmrf, collectionDate, area]
  );

  const total = centres.reduce((sum, m) => sum + (Number(amounts[m.MMRF_Code]) || 0), 0);
  const allFilled = centres.length > 0 && centres.every((m) => amounts[m.MMRF_Code] !== undefined && amounts[m.MMRF_Code] !== "");
  const canSave = Boolean(area) && Boolean(collectionDate) && !dateError && allFilled && !existing;

  const submit = async () => {
    setSaving(true);
    try {
      const lines = centres.map((m) => ({
        code: m.MMRF_Code,
        kg: Number(amounts[m.MMRF_Code]) || 0,
      }));
      await saveMmrfInward({ collectionDate, area, lines, user });
      toast.success(`${area} entry saved`, `${kg(total)} across ${lines.length} centres on ${date(collectionDate)}.`);
      setAmounts({});
      reload();
    } catch (err) {
      toast.error("Could not save the entry", err.message);
    } finally {
      setSaving(false);
    }
  };

  // The saved-entries list groups the per-MMRF rows back into one row per area and date.
  const savedEntries = useMemo(() => {
    const byBatch = new Map();
    for (const row of data.inwardMmrf) {
      if (String(row.Status || "").toLowerCase() === "deleted") continue;
      const key = row.Batch_Id || `${row.Area}-${row.Collection_Date}`;
      if (!byBatch.has(key)) {
        byBatch.set(key, {
          id: key, Collection_Date: row.Collection_Date, Area: row.Area,
          Total_Kg: 0, Centres: 0, Created_By: row.Created_By, Status: row.Status || "Active",
        });
      }
      const entry = byBatch.get(key);
      entry.Total_Kg += Number(row.Waste_Collected_Kg) || 0;
      entry.Centres += 1;
    }
    return [...byBatch.values()].sort((a, b) =>
      String(b.Collection_Date).localeCompare(String(a.Collection_Date))
    );
  }, [data.inwardMmrf]);

  return (
    <>
      <Card title="Record MMRF Collection" subtitle="One entry per area per date — all centres of the area together">
        <div className="formgrid">
          <div className="field">
            <label className="field__label">Waste collection date<span className="req">*</span></label>
            <input
              type="date" className={`input ${dateError ? "input--error" : ""}`}
              value={collectionDate} min={min} max={max}
              onChange={(e) => setCollectionDate(e.target.value)}
            />
            {dateError && <span className="field__error">{dateError}</span>}
          </div>

          <SelectInput
            label="Area" required value={area}
            onChange={(e) => { setArea(e.target.value); setAmounts({}); }}
            options={list(SETTING.areas)}
          />

          <div className="field">
            <label className="field__label">Total waste collected</label>
            <input className="input" value={kg(total)} disabled />
            <span className="field__hint">Calculated from the table below</span>
          </div>
        </div>

        {existing && (
          <div style={{ marginTop: 14 }}>
            <Banner tone="warn">
              An entry already exists for {area} on {date(collectionDate)}. Open it from the
              list below to edit it rather than creating a duplicate.
            </Banner>
          </div>
        )}

        {!area ? (
          <EmptyState title="Choose an Area" text="The active centres of that area will be listed here." />
        ) : centres.length === 0 ? (
          <EmptyState title="No Active Centres" text={`No MMRF / RRR Centre is active in ${area}.`} />
        ) : (
          <div className="tablewrap" style={{ marginTop: 16 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>MMRF name</th>
                  <th>Capacity</th>
                  <th style={{ width: 190 }}>Waste collected (kg)</th>
                </tr>
              </thead>
              <tbody>
                {centres.map((m) => (
                  <tr key={m.MMRF_Code}>
                    <td>
                      <span className="table__code">{m.MMRF_Code}</span> {m.MMRF_Name}
                    </td>
                    <td className="u-muted u-small">
                      {m.Capacity_Kg_Per_Day ? `${num(m.Capacity_Kg_Per_Day, 0)} kg/day` : "—"}
                    </td>
                    <td>
                      <input
                        type="number" min="0" step="0.01" className="input"
                        style={{ textAlign: "right" }} placeholder="0"
                        value={amounts[m.MMRF_Code] ?? ""}
                        onChange={(e) => setAmounts((a) => ({ ...a, [m.MMRF_Code]: e.target.value }))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {area && centres.length > 0 && (
          <div className="formactions">
            <span className="u-small u-muted u-grow">
              Enter 0 for a centre that collected nothing. Every row must have a value.
            </span>
            <Button onClick={submit} disabled={!canSave || saving}>
              {saving ? "Saving…" : "Submit entry"}
            </Button>
          </div>
        )}
      </Card>

      <div style={{ marginTop: 16 }}>
        <Card title="Saved Entries" flush>
          <DataTable
            rows={savedEntries} loading={loading} error={error} onRetry={reload}
            exportName="Inward_MMRF" emptyText="No MMRF entries yet"
            columns={[
              { key: "Collection_Date", header: "Date", render: (r) => date(r.Collection_Date) },
              { key: "Area", header: "Area" },
              { key: "Centres", header: "Centres", align: "right" },
              { key: "Total_Kg", header: "Total", align: "right", render: (r) => kg(r.Total_Kg) },
              { key: "Created_By", header: "Entered by", render: (r) => r.Created_By || "—" },
              { key: "Status", header: "Status", render: (r) => <Badge>{r.Status}</Badge> },
            ]}
          />
        </Card>
      </div>
    </>
  );
}
