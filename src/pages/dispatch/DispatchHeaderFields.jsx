import { SelectInput } from "../../components/common/Field";
import { SETTING } from "../../config/appConfig";
import { useSettings } from "../../context/SettingsContext";
import { active } from "../../hooks/useSheets";
import { today } from "../../utils/format";

/**
 * The fields every dispatch tab shares (section 14.1).
 * No rate or amount is entered — that is tracked outside the application.
 */
export default function DispatchHeaderFields({ values, onChange, vendors, showArea = false }) {
  const { list } = useSettings();
  const set = (key) => (e) => onChange({ ...values, [key]: e.target.value });

  return (
    <div className="formgrid">
      <div className="field">
        <label className="field__label">Dispatch date<span className="req">*</span></label>
        <input
          type="date" className="input" max={today()}
          value={values.Dispatch_Date} onChange={set("Dispatch_Date")}
        />
        <span className="field__hint">Cannot be in the future</span>
      </div>

      {showArea && (
        <SelectInput
          label="Area" required value={values.Area}
          onChange={set("Area")} options={list(SETTING.areas)}
        />
      )}

      <SelectInput
        label="Vendor" required value={values.Vendor_Code} onChange={set("Vendor_Code")}
        options={active(vendors).map((v) => ({
          value: v.Vendor_Code, label: `${v.Vendor_Code} — ${v.Vendor_Name}`,
        }))}
        placeholder="Choose the buying vendor…"
      />

      <SelectInput
        label="Purpose" required value={values.Purpose} onChange={set("Purpose")}
        options={list(SETTING.dispatchPurposes)}
        hint="Anything other than Disposal counts as landfill diversion"
      />

      <SelectInput
        label="Financials" required value={values.Financials} onChange={set("Financials")}
        options={list(SETTING.financials)}
        hint="No rate or amount is recorded here"
      />
    </div>
  );
}
