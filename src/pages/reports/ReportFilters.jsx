import { SelectInput } from "../../components/common/Field";
import { SETTING, SOURCE_TYPE_LABEL } from "../../config/appConfig";
import { useSettings } from "../../context/SettingsContext";
import { active } from "../../hooks/useSheets";
import { PERIOD_PRESETS } from "./reportCatalogue";

/** The period selector every report has, plus the filters it asks for. */
export default function ReportFilters({ report, values, onChange, data, allowedSources }) {
  const { list } = useSettings();
  const set = (key) => (e) => onChange({ ...values, [key]: e.target.value });

  const wants = (name) => report.filters?.includes(name);

  return (
    <div className="filterbar">
      <SelectInput
        label="Period" value={values.period} onChange={set("period")}
        options={PERIOD_PRESETS} placeholder="This month"
      />

      {values.period === "custom" && (
        <>
          <div className="field">
            <label className="field__label">From</label>
            <input type="date" className="input" value={values.from} onChange={set("from")} />
          </div>
          <div className="field">
            <label className="field__label">To</label>
            <input type="date" className="input" value={values.to} onChange={set("to")} />
          </div>
        </>
      )}

      {wants("area") && (
        <SelectInput
          label="Area" value={values.area} onChange={set("area")}
          options={list(SETTING.areas)} placeholder="All areas"
        />
      )}

      {wants("mmrf") && (
        <SelectInput
          label="Centre" value={values.mmrfCode} onChange={set("mmrfCode")}
          options={active(data.mmrfs).map((m) => ({
            value: m.MMRF_Code, label: `${m.MMRF_Code} — ${m.MMRF_Name}`,
          }))}
          placeholder="All centres"
        />
      )}

      {wants("vehicle") && (
        <SelectInput
          label="Vehicle" value={values.vehicleCode} onChange={set("vehicleCode")}
          options={active(data.vehicles).map((v) => ({
            value: v.Vehicle_Code, label: `${v.Vehicle_Code} — ${v.Registration_Number}`,
          }))}
          placeholder="All vehicles"
        />
      )}

      {wants("driver") && (
        <SelectInput
          label="Driver" value={values.driverCode} onChange={set("driverCode")}
          options={active(data.drivers).map((d) => ({
            value: d.Driver_Code, label: `${d.Driver_Code} — ${d.Driver_Name}`,
          }))}
          placeholder="All drivers"
        />
      )}

      {wants("vendor") && (
        <SelectInput
          label="Vendor" value={values.vendorCode} onChange={set("vendorCode")}
          options={active(data.vendors).map((v) => ({
            value: v.Vendor_Code, label: `${v.Vendor_Code} — ${v.Vendor_Name}`,
          }))}
          placeholder="All vendors"
        />
      )}

      {wants("collectedBy") && (
        <SelectInput
          label="Collected By" value={values.collectedBy} onChange={set("collectedBy")}
          options={list(SETTING.collectedByOptions)} placeholder="Anyone"
        />
      )}

      {wants("sourceType") && (
        <SelectInput
          label="Source Type" value={values.sourceType} onChange={set("sourceType")}
          options={["BWG", "RRR", "MMRF", "SPECIAL"]
            .filter((s) => !allowedSources?.length || allowedSources.includes(s))
            .map((s) => ({ value: s, label: SOURCE_TYPE_LABEL[s] }))}
          placeholder="Choose a source type"
        />
      )}
    </div>
  );
}
