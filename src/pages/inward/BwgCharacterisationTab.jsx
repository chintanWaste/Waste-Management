import { useMemo, useState } from "react";
import { Layers, Pencil } from "lucide-react";
import Badge from "../../components/common/Badge";
import Card from "../../components/common/Card";
import DataTable from "../../components/common/DataTable";
import { SelectInput } from "../../components/common/Field";
import { Banner, EmptyState } from "../../components/common/States";
import Button from "../../components/common/Button";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useSheets } from "../../hooks/useSheets";
import { saveCategoryLines, saveCharacterisation } from "../../services/inwardService";
import { date, kg, today } from "../../utils/format";
import { BWG_CHARACTERISATION } from "../../config/driveSchema";
import CategorySheet from "./CategorySheet";
import InwardEditDialog from "./InwardEditDialog";

/**
 * Section 12.6 — BWG characterisation, by vendor, per day.
 *
 * The total is the sum of every BWG daily figure for that date whose BWG was
 * linked to this vendor, across all areas. "Characterise" only opens once every
 * area where the vendor has linked BWGs has been submitted, so the total is
 * complete. Categories are recorded per vendor per day, never per BWG.
 */
export default function BwgCharacterisationTab() {
  const { user } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useSheets([
    "vendors", "inwardBwg", "bwgCharacterisation", "entryCategories",
  ]);

  const [collectionDate, setCollectionDate] = useState(today());
  const [vendorCode, setVendorCode] = useState("");
  const [characterising, setCharacterising] = useState(null);
  const [editing, setEditing] = useState(null);

  const vendorName = useMemo(
    () => Object.fromEntries(data.vendors.map((v) => [v.Vendor_Code, v.Vendor_Name])),
    [data.vendors]
  );

  const liveRows = useMemo(
    () => data.inwardBwg.filter((r) => String(r.Status || "").toLowerCase() !== "deleted"),
    [data.inwardBwg]
  );

  /** Vendors that had BWG collection on the chosen date. */
  const vendorsOnDate = useMemo(() => {
    const totals = new Map();
    for (const row of liveRows) {
      if (row.Collection_Date !== collectionDate || !row.Vendor_Code) continue;
      if (!totals.has(row.Vendor_Code)) {
        totals.set(row.Vendor_Code, { code: row.Vendor_Code, totalKg: 0, bwgs: 0, areas: new Set() });
      }
      const entry = totals.get(row.Vendor_Code);
      entry.totalKg += Number(row.Waste_Collected_Kg) || 0;
      entry.bwgs += 1;
      entry.areas.add(row.Area);
    }
    return [...totals.values()];
  }, [liveRows, collectionDate]);

  const selected = vendorsOnDate.find((v) => v.code === vendorCode) || null;

  const alreadyDone = data.bwgCharacterisation.find(
    (r) =>
      r.Collection_Date === collectionDate &&
      r.Vendor_Code === vendorCode &&
      String(r.Status || "").toLowerCase() !== "deleted"
  );

  const open = async () => {
    try {
      const id = await saveCharacterisation({
        collectionDate, vendorCode,
        totalKg: selected.totalKg, bwgCount: selected.bwgs, user,
      });
      setCharacterising({ id, totalKg: selected.totalKg, vendorCode, collectionDate });
    } catch (err) {
      toast.error("Could not start the characterisation", err.message);
    }
  };

  const submitCategories = async (lines) => {
    await saveCategoryLines({
      sourceType: "BWG",
      entryRefId: characterising.id,
      collectionDate: characterising.collectionDate,
      lines, user,
    });
    toast.success(
      "Characterisation submitted",
      `${characterising.vendorCode} on ${date(characterising.collectionDate)} is now categorised.`
    );
    setCharacterising(null);
    reload();
  };

  const saved = useMemo(() => {
    const done = new Set(
      data.entryCategories.filter((l) => l.Source_Type === "BWG").map((l) => l.Entry_Ref_Id)
    );
    return data.bwgCharacterisation.map((r) => ({
      ...r,
      Characterisation: done.has(r.Characterisation_Id) ? "Done" : "Pending",
    }));
  }, [data.bwgCharacterisation, data.entryCategories]);

  if (characterising) {
    return (
      <CategorySheet
        title="Categories of Waste"
        subtitle={`${characterising.vendorCode} — ${vendorName[characterising.vendorCode] || ""} · ${date(characterising.collectionDate)} · total ${kg(characterising.totalKg)}`}
        totalKg={characterising.totalKg}
        onSubmit={submitCategories}
        onCancel={() => setCharacterising(null)}
      />
    );
  }

  return (
    <>
      <Card
        title="Characterise a Vendor's BWG Collection"
        subtitle="Break one vendor's whole day of BWG collection into waste categories"
      >
        <div className="formgrid">
          <div className="field">
            <label className="field__label">Collection date<span className="req">*</span></label>
            <input
              type="date" className="input" max={today()}
              value={collectionDate}
              onChange={(e) => { setCollectionDate(e.target.value); setVendorCode(""); }}
            />
          </div>

          <SelectInput
            label="Vendor" required value={vendorCode}
            onChange={(e) => setVendorCode(e.target.value)}
            options={vendorsOnDate.map((v) => ({
              value: v.code, label: `${v.code} — ${vendorName[v.code] || "Unknown"}`,
            }))}
            placeholder={vendorsOnDate.length ? "Choose a vendor…" : "No vendor collected that day"}
            hint="Only vendors with BWG collection on this date"
          />

          <div className="field">
            <label className="field__label">Total collected by vendor</label>
            <input className="input" value={selected ? kg(selected.totalKg) : "—"} disabled />
            <span className="field__hint">Sum across all areas, calculated automatically</span>
          </div>

          <div className="field">
            <label className="field__label">Number of BWGs</label>
            <input className="input" value={selected ? selected.bwgs : "—"} disabled />
            <span className="field__hint">
              {selected ? `Areas: ${[...selected.areas].join(", ")}` : "Contributing to the total"}
            </span>
          </div>
        </div>

        {vendorsOnDate.length === 0 && (
          <div style={{ marginTop: 14 }}>
            <Banner tone="warn">
              No BWG daily entry has been submitted for {date(collectionDate)}. Record the day's
              BWG collection first — the total here is calculated from it.
            </Banner>
          </div>
        )}

        {alreadyDone && (
          <div style={{ marginTop: 14 }}>
            <Banner tone="info">
              A characterisation already exists for this vendor and date. Open it from the list
              below to edit it.
            </Banner>
          </div>
        )}

        {selected && !alreadyDone && (
          <Banner tone="info" >
            Make sure every area where {selected.code} has linked BWGs has been submitted for
            {" "}{date(collectionDate)} — the total above must be the vendor's complete day.
          </Banner>
        )}

        <div className="formactions">
          <Button onClick={open} disabled={!selected || Boolean(alreadyDone)}>
            <Layers size={15} aria-hidden="true" />
            Characterise
          </Button>
        </div>
      </Card>

      <div style={{ marginTop: 16 }}>
        <Card title="Characterisations" flush>
          <DataTable
            rows={saved} loading={loading} error={error} onRetry={reload}
            exportName="BWG_Characterisation" emptyText="No characterisations yet"
            columns={[
              { key: "Collection_Date", header: "Date", render: (r) => date(r.Collection_Date) },
              {
                key: "Vendor_Code", header: "Vendor",
                render: (r) => `${r.Vendor_Code} — ${vendorName[r.Vendor_Code] || "Unknown"}`,
              },
              { key: "Number_Of_BWGs", header: "BWGs", align: "right" },
              { key: "Total_Collected_Kg", header: "Total", align: "right", render: (r) => kg(r.Total_Collected_Kg) },
              { key: "Characterisation", header: "Status", render: (r) => <Badge>{r.Characterisation}</Badge> },
              {
                key: "actions", header: "Actions", sortable: false, align: "center",
                exportValue: () => "",
                render: (r) => (
                  <div className="u-row" style={{ gap: 4, justifyContent: "center" }}>
                    {r.Characterisation === "Pending" && (
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={() =>
                          setCharacterising({
                            id: r.Characterisation_Id,
                            totalKg: Number(r.Total_Collected_Kg),
                            vendorCode: r.Vendor_Code,
                            collectionDate: r.Collection_Date,
                          })
                        }
                      >
                        <Layers size={13} aria-hidden="true" />
                        Categories
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => setEditing(r)}
                      title={`Edit ${r.Characterisation_Id}`}
                    >
                      <Pencil size={13} aria-hidden="true" />
                      Edit
                    </button>
                  </div>
                ),
              },
            ]}
          />
        </Card>
      </div>

      <InwardEditDialog
        open={Boolean(editing)}
        tab={BWG_CHARACTERISATION}
        row={editing}
        quantityField="Total_Collected_Kg"
        label={editing ? `${editing.Vendor_Code} on ${date(editing.Collection_Date)}` : ""}
        categorised
        onSaved={() => { setEditing(null); reload(); }}
        onClose={() => setEditing(null)}
      />
    </>
  );
}
