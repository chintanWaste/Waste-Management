import { SETTING, SOURCE_TYPE_LABEL } from "../../config/appConfig";
import { useSettings } from "../../context/SettingsContext";
import { SelectInput } from "../common/Field";

const PERIODS = [
  { value: "this-month", label: "This month" },
  { value: "last-month", label: "Last month" },
  { value: "this-quarter", label: "This quarter" },
  { value: "this-fy", label: "This financial year" },
  { value: "custom", label: "Custom range" },
];

/** Filters that apply to every card and graph (section 6.1). */
export default function DashboardFilters({ value, onChange, allowedSources }) {
  const { list } = useSettings();
  const set = (key) => (e) => onChange({ ...value, [key]: e.target.value });

  const sources = list(SETTING.sourceTypes)
    .filter((key) => !allowedSources?.length || allowedSources.includes(key))
    .map((key) => ({ value: key, label: SOURCE_TYPE_LABEL[key] || key }));

  return (
    <div className="filterbar">
      <SelectInput
        label="Period"
        value={value.period}
        onChange={set("period")}
        options={PERIODS}
        placeholder="This month"
      />

      {value.period === "custom" && (
        <>
          <div className="field">
            <label className="field__label">From</label>
            <input type="date" className="input" value={value.from} onChange={set("from")} />
          </div>
          <div className="field">
            <label className="field__label">To</label>
            <input type="date" className="input" value={value.to} onChange={set("to")} />
          </div>
        </>
      )}

      <SelectInput label="Area" value={value.area} onChange={set("area")} options={list(SETTING.areas)} placeholder="All areas" />

      <SelectInput
        label="Source Type"
        value={value.source}
        onChange={set("source")}
        options={sources}
        placeholder="All sources"
      />

      <SelectInput
        label="Waste Stream"
        value={value.stream}
        onChange={set("stream")}
        options={list(SETTING.wasteStreams)}
        placeholder="All streams"
      />

      <div className="u-grow" />
      <button className="btn btn--secondary" onClick={() => onChange({ period: "this-month", area: "", source: "", stream: "", from: "", to: "" })}>
        Reset
      </button>
    </div>
  );
}
