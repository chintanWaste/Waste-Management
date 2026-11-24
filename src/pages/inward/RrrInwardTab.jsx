import { useMemo, useState } from "react";
import { Layers, Pencil } from "lucide-react";
import Badge from "../../components/common/Badge";
import Button from "../../components/common/Button";
import Card from "../../components/common/Card";
import DataTable from "../../components/common/DataTable";
import PhotoUpload from "../../components/common/PhotoUpload";
import { SelectInput, TextInput } from "../../components/common/Field";
import { Banner } from "../../components/common/States";
import { SETTING } from "../../config/appConfig";
import { INWARD_RRR } from "../../config/driveSchema";
import { useAuth } from "../../context/AuthContext";
import { useSettings } from "../../context/SettingsContext";
import { useToast } from "../../context/ToastContext";
import { useSheets } from "../../hooks/useSheets";
import { saveCategoryLines, saveRrrInward } from "../../services/inwardService";
import { date, kg } from "../../utils/format";
import { usableDrivers, usableVehicles } from "../../utils/expiry";
import * as v from "../../utils/validators";
import CategorySheet from "./CategorySheet";
import InwardEditDialog from "./InwardEditDialog";
import { useCollectionDate } from "./useCollectionDate";

const EMPTY = { Vehicle_Code: "", Driver_Code: "", Area: "", Total_Waste_Collected_Kg: "" };

/** Section 12.3 — RRR on Wheels inward. One entry per vehicle per date. */
export default function RrrInwardTab() {
  const { user } = useAuth();
  const { list, number } = useSettings();
  const toast = useToast();
  const { data, loading, error, reload } = useSheets([
    "vehicles", "drivers", "inwardRrr", "entryCategories",
  ]);

  const { value: collectionDate, setValue: setCollectionDate, min, max, error: dateError } =
    useCollectionDate();
  const [values, setValues] = useState(EMPTY);
  const [photos, setPhotos] = useState([]);
  const [saving, setSaving] = useState(false);
  const [categorising, setCategorising] = useState(null);
  const [editing, setEditing] = useState(null);

  const set = (key) => (e) => setValues((val) => ({ ...val, [key]: e.target.value }));

  // Only vehicles and drivers whose documents are valid on the collection date.
  const vehicles = useMemo(
    () => usableVehicles(data.vehicles, collectionDate),
    [data.vehicles, collectionDate]
  );
  const drivers = useMemo(
    () => usableDrivers(data.drivers, collectionDate),
    [data.drivers, collectionDate]
  );

  const blockedVehicles = data.vehicles.length - vehicles.length;
  const weightError = values.Total_Waste_Collected_Kg ? v.weight(values.Total_Waste_Collected_Kg) : "";

  const duplicate = data.inwardRrr.find(
    (r) =>
      String(r.Status || "").toLowerCase() !== "deleted" &&
      r.Collection_Date === collectionDate &&
      r.Vehicle_Code === values.Vehicle_Code
  );

  const ready =
    !dateError && !weightError &&
    values.Vehicle_Code && values.Driver_Code && values.Area &&
    Number(values.Total_Waste_Collected_Kg) > 0 &&
    photos.length > 0 && !duplicate;

  const submit = async () => {
    setSaving(true);
    try {
      const entryId = await saveRrrInward({
        values: { ...values, Collection_Date: collectionDate }, photos, user,
      });
      toast.success(`Entry ${entryId} saved`, "Now break the total into categories.");
      setValues(EMPTY);
      setPhotos([]);
      reload();
      setCategorising({
        entryId,
        totalKg: Number(values.Total_Waste_Collected_Kg),
        label: `${values.Vehicle_Code} on ${date(collectionDate)}`,
        collectionDate,
      });
    } catch (err) {
      toast.error("Could not save the entry", err.message);
    } finally {
      setSaving(false);
    }
  };

  const submitCategories = async (lines) => {
    await saveCategoryLines({
      sourceType: "RRR",
      entryRefId: categorising.entryId,
      collectionDate: categorising.collectionDate,
      lines, user,
    });
    toast.success("Categories submitted", `${categorising.entryId} is now categorised.`);
    setCategorising(null);
    reload();
  };

  const categorised = useMemo(() => {
    const done = new Set(
      data.entryCategories.filter((l) => l.Source_Type === "RRR").map((l) => l.Entry_Ref_Id)
    );
    return data.inwardRrr.map((r) => ({
      ...r,
      Categorisation: done.has(r.Entry_Id) ? "Done" : "Pending",
    }));
  }, [data.inwardRrr, data.entryCategories]);

  if (categorising) {
    return (
      <CategorySheet
        title="Categories of Waste"
        subtitle={`${categorising.label} · total ${kg(categorising.totalKg)}`}
        totalKg={categorising.totalKg}
        onSubmit={submitCategories}
        onCancel={() => setCategorising(null)}
      />
    );
  }

  return (
    <>
      <Card title="Record RRR on Wheels Collection" subtitle="One entry per vehicle per date — all trips of the day added together">
        <Banner tone="info">
          Do not include waste collected on special requests; enter it in the
          Special collection tab.
        </Banner>

        <div className="formgrid" style={{ marginTop: 16 }}>
          <div className="field">
            <label className="field__label">Collection date<span className="req">*</span></label>
            <input
              type="date" className={`input ${dateError ? "input--error" : ""}`}
              value={collectionDate} min={min} max={max}
              onChange={(e) => setCollectionDate(e.target.value)}
            />
            {dateError && <span className="field__error">{dateError}</span>}
          </div>

          <SelectInput
            label="Vehicle" required value={values.Vehicle_Code} onChange={set("Vehicle_Code")}
            options={vehicles.map((v) => ({ value: v.Vehicle_Code, label: `${v.Vehicle_Code} — ${v.Registration_Number}` }))}
            hint={blockedVehicles > 0 ? `${blockedVehicles} vehicle(s) hidden — documents expired on this date` : undefined}
          />

          <SelectInput
            label="Driver" required value={values.Driver_Code} onChange={set("Driver_Code")}
            options={drivers.map((d) => ({ value: d.Driver_Code, label: `${d.Driver_Code} — ${d.Driver_Name}` }))}
          />

          <SelectInput label="Area" required value={values.Area} onChange={set("Area")} options={list(SETTING.areas)} />

          <TextInput
            label="Total Waste Collected (kg)" required inputMode="decimal"
            placeholder="0.00" error={weightError}
            hint="Total of all trips of the day"
            value={values.Total_Waste_Collected_Kg} onChange={set("Total_Waste_Collected_Kg")}
          />
        </div>

        {duplicate && (
          <div style={{ marginTop: 14 }}>
            <Banner tone="warn">An entry exists for this vehicle on this date – edit it instead.</Banner>
          </div>
        )}

        <div className="formsection" style={{ marginTop: 8 }}>
          <PhotoUpload
            label="Photos" required
            maxFiles={number(SETTING.maxPhotosPerEntry, 5)}
            maxTotalMb={number(SETTING.maxUploadMb, 5)}
            value={photos} onChange={setPhotos}
          />
        </div>

        <div className="formactions">
          <Button onClick={submit} disabled={!ready || saving}>
            {saving ? "Saving…" : "Submit entry"}
          </Button>
        </div>
      </Card>

      <div style={{ marginTop: 16 }}>
        <Card title="Saved Entries" flush>
          <DataTable
            rows={categorised} loading={loading} error={error} onRetry={reload}
            exportName="Inward_RRR" emptyText="No RRR on Wheels entries yet"
            columns={[
              { key: "Collection_Date", header: "Date", render: (r) => date(r.Collection_Date) },
              { key: "Vehicle_Code", header: "Vehicle" },
              { key: "Driver_Code", header: "Driver" },
              { key: "Area", header: "Area" },
              { key: "Total_Waste_Collected_Kg", header: "Total", align: "right", render: (r) => kg(r.Total_Waste_Collected_Kg) },
              { key: "Categorisation", header: "Categories", render: (r) => <Badge>{r.Categorisation}</Badge> },
              {
                key: "actions", header: "Actions", sortable: false, align: "center",
                exportValue: () => "",
                render: (r) => (
                  <div className="u-row" style={{ gap: 4, justifyContent: "center" }}>
                    {r.Categorisation === "Pending" && (
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={() =>
                          setCategorising({
                            entryId: r.Entry_Id,
                            totalKg: Number(r.Total_Waste_Collected_Kg),
                            label: `${r.Vehicle_Code} on ${date(r.Collection_Date)}`,
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
                      title={`Edit ${r.Entry_Id}`}
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
        tab={INWARD_RRR}
        row={editing}
        quantityField="Total_Waste_Collected_Kg"
        label={editing ? `${editing.Vehicle_Code} on ${date(editing.Collection_Date)}` : ""}
        categorised
        onSaved={() => { setEditing(null); reload(); }}
        onClose={() => setEditing(null)}
      />
    </>
  );
}
