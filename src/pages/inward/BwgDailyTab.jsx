import { useMemo, useState } from "react";
import Badge from "../../components/common/Badge";
import Button from "../../components/common/Button";
import Card from "../../components/common/Card";
import DataTable from "../../components/common/DataTable";
import FileUpload from "../../components/common/FileUpload";
import { SelectInput } from "../../components/common/Field";
import { Banner, EmptyState } from "../../components/common/States";
import { SETTING } from "../../config/appConfig";
import { useAuth } from "../../context/AuthContext";
import { useSettings } from "../../context/SettingsContext";
import { useToast } from "../../context/ToastContext";
import { active, useSheets } from "../../hooks/useSheets";
import { saveBwgInward } from "../../services/inwardService";
import { vendorOnDate } from "../../services/linkageService";
import { date, kg, parseDate } from "../../utils/format";
import { useCollectionDate } from "./useCollectionDate";

/**
 * Section 12.5 — BWG daily inward.
 *
 * Lists every BWG of the area that is active, linked to a vendor, and onboarded
 * on or before the date. Submit is enabled only when every row has a value;
 * users enter 0 for a BWG with no collection that day. There is no draft.
 */
export default function BwgDailyTab() {
  const { user } = useAuth();
  const { list, number } = useSettings();
  const toast = useToast();
  const { data, loading, error, reload } = useSheets(["bwgs", "vendors", "linkage", "inwardBwg"]);

  const [area, setArea] = useState("");
  const { value: collectionDate, setValue: setCollectionDate, min, max, error: dateError } =
    useCollectionDate();
  const [amounts, setAmounts] = useState({});
  const [photo, setPhoto] = useState(null);
  const [saving, setSaving] = useState(false);

  const vendorName = useMemo(
    () => Object.fromEntries(data.vendors.map((v) => [v.Vendor_Code, v.Vendor_Name])),
    [data.vendors]
  );

  /** Eligible BWGs: active, in the area, onboarded by the date, linked that day. */
  const eligible = useMemo(() => {
    if (!area || !collectionDate) return [];
    const when = parseDate(collectionDate);

    return active(data.bwgs)
      .filter((b) => b.Area === area)
      .filter((b) => {
        const onboarded = parseDate(b.Onboarding_Date);
        return onboarded && onboarded <= when;
      })
      .map((b) => ({ ...b, vendorCode: vendorOnDate(data.linkage, b.BWG_Code, collectionDate) }))
      .filter((b) => b.vendorCode);
  }, [data.bwgs, data.linkage, area, collectionDate]);

  const skipped = useMemo(() => {
    if (!area || !collectionDate) return 0;
    const when = parseDate(collectionDate);
    return active(data.bwgs).filter(
      (b) =>
        b.Area === area &&
        parseDate(b.Onboarding_Date) <= when &&
        !vendorOnDate(data.linkage, b.BWG_Code, collectionDate)
    ).length;
  }, [data.bwgs, data.linkage, area, collectionDate]);

  const existing = data.inwardBwg.find(
    (r) =>
      String(r.Status || "").toLowerCase() !== "deleted" &&
      r.Collection_Date === collectionDate && r.Area === area
  );

  const total = eligible.reduce((sum, b) => sum + (Number(amounts[b.BWG_Code]) || 0), 0);
  const allFilled =
    eligible.length > 0 &&
    eligible.every((b) => amounts[b.BWG_Code] !== undefined && amounts[b.BWG_Code] !== "");
  const canSave = allFilled && Boolean(photo) && !dateError && !existing;

  const submit = async () => {
    setSaving(true);
    try {
      const lines = eligible.map((b) => ({
        bwgCode: b.BWG_Code,
        vendorCode: b.vendorCode,
        kg: Number(amounts[b.BWG_Code]) || 0,
      }));
      await saveBwgInward({ collectionDate, area, lines, photo, user });
      toast.success(`${area} entry saved`, `${kg(total)} across ${lines.length} BWGs on ${date(collectionDate)}.`);
      setAmounts({});
      setPhoto(null);
      reload();
    } catch (err) {
      toast.error("Could not save the entry", err.message);
    } finally {
      setSaving(false);
    }
  };

  const savedEntries = useMemo(() => {
    const byBatch = new Map();
    for (const row of data.inwardBwg) {
      if (String(row.Status || "").toLowerCase() === "deleted") continue;
      const key = row.Batch_Id || `${row.Area}-${row.Collection_Date}`;
      if (!byBatch.has(key)) {
        byBatch.set(key, {
          id: key, Collection_Date: row.Collection_Date, Area: row.Area,
          Total_Kg: 0, BWGs: 0, Status: row.Status || "Active",
        });
      }
      const entry = byBatch.get(key);
      entry.Total_Kg += Number(row.Waste_Collected_Kg) || 0;
      entry.BWGs += 1;
    }
    return [...byBatch.values()].sort((a, b) =>
      String(b.Collection_Date).localeCompare(String(a.Collection_Date))
    );
  }, [data.inwardBwg]);

  return (
    <>
      <Card title="Record BWG Collection" subtitle="All BWGs of an area, for one date, submitted together">
        <div className="formgrid">
          <div className="field">
            <label className="field__label">Collection date<span className="req">*</span></label>
            <input
              type="date" className={`input ${dateError ? "input--error" : ""}`}
              value={collectionDate} min={min} max={max}
              onChange={(e) => { setCollectionDate(e.target.value); setAmounts({}); }}
            />
            {dateError && <span className="field__error">{dateError}</span>}
          </div>

          <SelectInput
            label="Area" required value={area}
            onChange={(e) => { setArea(e.target.value); setAmounts({}); }}
            options={list(SETTING.areas)}
          />

          <div className="field">
            <label className="field__label">Total for the area</label>
            <input className="input" value={kg(total)} disabled />
          </div>
        </div>

        {existing && (
          <div style={{ marginTop: 14 }}>
            <Banner tone="warn">
              An entry already exists for {area} on {date(collectionDate)}. Open it from the list
              below to edit it.
            </Banner>
          </div>
        )}

        {skipped > 0 && (
          <div style={{ marginTop: 14 }}>
            <Banner tone="warn">
              {skipped} BWG{skipped === 1 ? " is" : "s are"} not listed because they had no linked
              vendor on this date. Link them on the BWG–Vendor linkage page first.
            </Banner>
          </div>
        )}

        {!area ? (
          <EmptyState title="Choose an Area" text="The BWGs collected in that area will be listed here." />
        ) : eligible.length === 0 ? (
          <EmptyState
            title="No BWGs to Record"
            text={`No active, vendor-linked BWG in ${area} was onboarded on or before ${date(collectionDate)}.`}
          />
        ) : (
          <>
            <div className="tablewrap" style={{ marginTop: 16 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>BWG code</th>
                    <th>BWG name</th>
                    <th>Vendor on this date</th>
                    <th style={{ width: 180 }}>Waste collected (kg)</th>
                  </tr>
                </thead>
                <tbody>
                  {eligible.map((b) => (
                    <tr key={b.BWG_Code}>
                      <td><span className="table__code">{b.BWG_Code}</span></td>
                      <td>{b.BWG_Name}</td>
                      <td className="u-small">
                        {b.vendorCode} — {vendorName[b.vendorCode] || "Unknown"}
                      </td>
                      <td>
                        <input
                          type="number" min="0" step="0.01" className="input"
                          style={{ textAlign: "right" }} placeholder="0"
                          value={amounts[b.BWG_Code] ?? ""}
                          onChange={(e) => setAmounts((a) => ({ ...a, [b.BWG_Code]: e.target.value }))}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="formsection" style={{ marginTop: 16 }}>
              <FileUpload
                label="Photo" required accept="image/jpeg,image/png"
                maxMb={number(SETTING.maxPhotoMb, 3)}
                helpText="One photo per submission, covering this area and date."
                value={photo} onChange={setPhoto}
              />
            </div>

            <div className="formactions">
              <span className="u-small u-muted u-grow">
                Enter 0 for a BWG with no collection that day. There is no draft — submit once
                every figure is available.
              </span>
              <Button onClick={submit} disabled={!canSave || saving}>
                {saving ? "Saving…" : "Submit entry"}
              </Button>
            </div>
          </>
        )}
      </Card>

      <div style={{ marginTop: 16 }}>
        <Card title="Inward Directory" flush>
          <DataTable
            rows={savedEntries} loading={loading} error={error} onRetry={reload}
            exportName="Inward_BWG" emptyText="No BWG entries yet"
            columns={[
              { key: "Collection_Date", header: "Date", render: (r) => date(r.Collection_Date) },
              { key: "Area", header: "Area" },
              { key: "BWGs", header: "BWGs", align: "right" },
              { key: "Total_Kg", header: "Total", align: "right", render: (r) => kg(r.Total_Kg) },
              { key: "Status", header: "Status", render: (r) => <Badge>{r.Status}</Badge> },
            ]}
          />
        </Card>
      </div>
    </>
  );
}
