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
import { useAuth } from "../../context/AuthContext";
import { useSettings } from "../../context/SettingsContext";
import { useToast } from "../../context/ToastContext";
import { active, useSheets } from "../../hooks/useSheets";
import { saveCategoryLines, saveSpecialInward } from "../../services/inwardService";
import { date, kg } from "../../utils/format";
import { usableDrivers, usableVehicles } from "../../utils/expiry";
import * as v from "../../utils/validators";
import { INWARD_SPECIAL } from "../../config/driveSchema";
import CategorySheet from "./CategorySheet";
import InwardEditDialog from "./InwardEditDialog";
import { useCollectionDate } from "./useCollectionDate";

const EMPTY = {
  Location: "", Area: "", Contact_Person: "", Phone: "", Email: "",
  Collected_By: "", Vendor_Code: "", Vehicle_Code: "", Driver_Code: "",
  Total_Waste_Collected_Kg: "",
};

/** Section 12.7 — special collection requests and drives. Several per date. */
export default function SpecialCollectionTab() {
  const { user } = useAuth();
  const { list, number } = useSettings();
  const toast = useToast();
  const { data, loading, error, reload } = useSheets([
    "vendors", "vehicles", "drivers", "inwardSpecial", "entryCategories",
  ]);

  const { value: collectionDate, setValue: setCollectionDate, min, max, error: dateError } =
    useCollectionDate();
  const [values, setValues] = useState(EMPTY);
  const [photos, setPhotos] = useState([]);
  const [saving, setSaving] = useState(false);
  const [categorising, setCategorising] = useState(null);
  const [editing, setEditing] = useState(null);

  const set = (key) => (e) => setValues((val) => ({ ...val, [key]: e.target.value }));
  const byVendor = values.Collected_By === "Vendor";
  const byVehicle = values.Collected_By && !byVendor;

  const vehicles = useMemo(
    () => usableVehicles(data.vehicles, collectionDate),
    [data.vehicles, collectionDate]
  );
  const drivers = useMemo(
    () => usableDrivers(data.drivers, collectionDate),
    [data.drivers, collectionDate]
  );

  const weightError = values.Total_Waste_Collected_Kg ? v.weight(values.Total_Waste_Collected_Kg) : "";
  const phoneError = values.Phone ? v.phone(values.Phone) : "";
  const emailError = values.Email ? v.email(values.Email) : "";

  const ready =
    !dateError && !weightError && !phoneError && !emailError &&
    values.Location.trim() && values.Area && values.Contact_Person.trim() && values.Phone &&
    values.Collected_By &&
    (byVendor ? values.Vendor_Code : values.Vehicle_Code && values.Driver_Code) &&
    Number(values.Total_Waste_Collected_Kg) > 0 &&
    photos.length > 0;

  const submit = async () => {
    setSaving(true);
    try {
      const code = await saveSpecialInward({
        values: { ...values, Collection_Date: collectionDate }, photos, user,
      });
      toast.success(`Entry ${code} saved`, "Now break the total into categories.");
      const totalKg = Number(values.Total_Waste_Collected_Kg);
      const location = values.Location;
      setValues(EMPTY);
      setPhotos([]);
      reload();
      setCategorising({ entryId: code, totalKg, label: `${code} · ${location}`, collectionDate });
    } catch (err) {
      toast.error("Could not save the entry", err.message);
    } finally {
      setSaving(false);
    }
  };

  const submitCategories = async (lines) => {
    await saveCategoryLines({
      sourceType: "SPECIAL",
      entryRefId: categorising.entryId,
      collectionDate: categorising.collectionDate,
      lines, user,
    });
    toast.success("Categories submitted", `${categorising.entryId} is now categorised.`);
    setCategorising(null);
    reload();
  };

  const entries = useMemo(() => {
    const done = new Set(
      data.entryCategories.filter((l) => l.Source_Type === "SPECIAL").map((l) => l.Entry_Ref_Id)
    );
    return data.inwardSpecial.map((r) => ({
      ...r,
      Categorisation: done.has(r.Entry_Code) ? "Done" : "Pending",
      Collector: r.Vendor_Code || r.Vehicle_Code || "—",
    }));
  }, [data.inwardSpecial, data.entryCategories]);

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
      <Card title="Record a Special Collection" subtitle="Several entries per date are allowed">
        <Banner tone="info">
          Waste collected by an RRR vehicle on a special request is entered only here,
          never in that vehicle's RRR daily total.
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

          <TextInput label="Location" required value={values.Location} onChange={set("Location")} />
          <SelectInput label="Area" required value={values.Area} onChange={set("Area")} options={list(SETTING.areas)} />
          <TextInput label="Contact Person" required value={values.Contact_Person} onChange={set("Contact_Person")} />
          <TextInput label="Phone Number" required inputMode="tel" error={phoneError} value={values.Phone} onChange={set("Phone")} />
          <TextInput label="Email" type="email" hint="Optional" error={emailError} value={values.Email} onChange={set("Email")} />
        </div>

        <div className="formsection">
          <div className="formsection__title">Who collected it</div>
          <div className="formgrid">
            <SelectInput
              label="Collected By" required value={values.Collected_By}
              onChange={(e) =>
                setValues((val) => ({
                  ...val, Collected_By: e.target.value,
                  Vendor_Code: "", Vehicle_Code: "", Driver_Code: "",
                }))
              }
              options={list(SETTING.collectedByOptions)}
            />

            <SelectInput
              label="Vendor" required={byVendor} disabled={!byVendor}
              value={values.Vendor_Code} onChange={set("Vendor_Code")}
              options={active(data.vendors).map((v) => ({
                value: v.Vendor_Code, label: `${v.Vendor_Code} — ${v.Vendor_Name}`,
              }))}
              placeholder={byVendor ? "Choose a vendor…" : "Not applicable"}
            />

            <SelectInput
              label="Vehicle" required={byVehicle} disabled={!byVehicle}
              value={values.Vehicle_Code} onChange={set("Vehicle_Code")}
              options={vehicles.map((v) => ({
                value: v.Vehicle_Code, label: `${v.Vehicle_Code} — ${v.Registration_Number}`,
              }))}
              placeholder={byVehicle ? "Choose a vehicle…" : "Not applicable"}
            />

            <SelectInput
              label="Driver" required={byVehicle} disabled={!byVehicle}
              value={values.Driver_Code} onChange={set("Driver_Code")}
              options={drivers.map((d) => ({
                value: d.Driver_Code, label: `${d.Driver_Code} — ${d.Driver_Name}`,
              }))}
              placeholder={byVehicle ? "Choose a driver…" : "Not applicable"}
            />

            <TextInput
              label="Total Waste Collected (kg)" required inputMode="decimal"
              placeholder="0.00" error={weightError}
              value={values.Total_Waste_Collected_Kg} onChange={set("Total_Waste_Collected_Kg")}
            />
          </div>
        </div>

        <div className="formsection">
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
            rows={entries} loading={loading} error={error} onRetry={reload}
            exportName="Inward_Special" emptyText="No special collections yet"
            columns={[
              { key: "Collection_Date", header: "Date", render: (r) => date(r.Collection_Date) },
              { key: "Entry_Code", header: "Code", render: (r) => <span className="table__code">{r.Entry_Code}</span> },
              { key: "Location", header: "Location" },
              { key: "Area", header: "Area" },
              { key: "Collected_By", header: "Collected by" },
              { key: "Collector", header: "Who" },
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
                            entryId: r.Entry_Code,
                            totalKg: Number(r.Total_Waste_Collected_Kg),
                            label: `${r.Entry_Code} · ${r.Location}`,
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
                      title={`Edit ${r.Entry_Code}`}
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
        tab={INWARD_SPECIAL}
        row={editing}
        quantityField="Total_Waste_Collected_Kg"
        label={editing ? `${editing.Entry_Code} · ${editing.Location}` : ""}
        categorised
        onSaved={() => { setEditing(null); reload(); }}
        onClose={() => setEditing(null)}
      />
    </>
  );
}
