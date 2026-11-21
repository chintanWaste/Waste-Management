import { useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import Button from "../../components/common/Button";
import { SearchBox } from "../../components/common/Field";
import { Banner, EmptyState, Loading } from "../../components/common/States";
import { SETTING } from "../../config/appConfig";
import { useSettings } from "../../context/SettingsContext";
import { useCategories } from "../../hooks/useCategories";
import { kg, num } from "../../utils/format";

/**
 * "Categories of waste" — specification section 12.4.
 *
 * Shared by RRR on Wheels, Special collection and BWG characterisation.
 * Submit is enabled only when the categories add up exactly to the total.
 * Used Cooking Oil is entered in litres and converted at the Settings factor,
 * so it counts in the kg total like every other category.
 */
export default function CategorySheet({ title, subtitle, totalKg, onSubmit, onCancel }) {
  const { number } = useSettings();
  const { grouped, loading } = useCategories();
  const litreToKg = number(SETTING.litreToKgFactor, 0.92);

  const [amounts, setAmounts] = useState({});
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  /** Entered value converted to kg — litres multiplied by the factor. */
  const toKg = (category, entered) => {
    const n = Number(entered);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return category.unit === "Litre" ? n * litreToKg : n;
  };

  const lines = useMemo(() => {
    const out = [];
    for (const stream of grouped) {
      for (const group of stream.groups) {
        for (const category of group.items) {
          const entered = amounts[category.id];
          if (entered === undefined || entered === "") continue;
          const quantityKg = toKg(category, entered);
          if (quantityKg <= 0) continue;
          out.push({
            categoryId: category.id,
            name: category.name,
            group: category.group,
            stream: category.stream,
            unit: category.unit,
            quantityEntered: Number(entered),
            quantityKg: Number(quantityKg.toFixed(2)),
          });
        }
      }
    }
    return out;
  }, [amounts, grouped, litreToKg]);

  const entered = lines.reduce((sum, l) => sum + l.quantityKg, 0);
  const target = Number(totalKg) || 0;
  const remaining = Number((target - entered).toFixed(2));
  const balanced = Math.abs(remaining) < 0.005 && target > 0;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return grouped;
    return grouped
      .map((stream) => ({
        ...stream,
        groups: stream.groups
          .map((g) => ({ ...g, items: g.items.filter((c) => c.name.toLowerCase().includes(q)) }))
          .filter((g) => g.items.length),
      }))
      .filter((s) => s.groups.length);
  }, [grouped, query]);

  const submit = async () => {
    setSaving(true);
    setError("");
    try {
      await onSubmit(lines);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading text="Loading the category master…" />;

  if (!grouped.length) {
    return (
      <EmptyState
        title="No Waste Categories"
        text="The Waste_Categories tab is empty. Import the template into the Google Sheet first."
      />
    );
  }

  return (
    <div className="catsheet">
      <header className="catsheet__head">
        <div>
          <div className="card__title">{title}</div>
          {subtitle && <div className="u-small u-muted">{subtitle}</div>}
        </div>
        <SearchBox value={query} onChange={setQuery} placeholder="Find a category…" />
      </header>

      {error && <div style={{ padding: "0 16px" }}><Banner tone="danger">{error}</Banner></div>}

      <div className="catsheet__body">
        {visible.length === 0 ? (
          <EmptyState title="No Category Matches" text="Clear the search to see the full master." />
        ) : (
          visible.map((stream) => (
            <section key={stream.stream} className="catgroup">
              <h3 className="catgroup__stream">{stream.stream}</h3>
              {stream.groups.map((group) => (
                <div key={group.group} className="catgroup__material">
                  <div className="catgroup__materialname">{group.group}</div>
                  <div className="catgrid">
                    {group.items.map((category) => {
                      const value = amounts[category.id] ?? "";
                      const asKg = toKg(category, value);
                      return (
                        <label key={category.id} className={`catrow ${value ? "catrow--filled" : ""}`}>
                          <span className="catrow__name">{category.name}</span>
                          <span className="catrow__input">
                            <input
                              type="number" min="0" step="0.01" inputMode="decimal"
                              className="input" placeholder="0"
                              value={value}
                              onChange={(e) =>
                                setAmounts((a) => ({ ...a, [category.id]: e.target.value }))
                              }
                            />
                            <span className="catrow__unit">{category.unit === "Litre" ? "L" : "kg"}</span>
                          </span>
                          {category.unit === "Litre" && (
                            <span className="catrow__convert">
                              {value ? `= ${num(asKg, 2)} kg` : `× ${litreToKg} kg/L`}
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </section>
          ))
        )}
      </div>

      <footer className={`catsheet__foot ${balanced ? "catsheet__foot--ok" : ""}`}>
        <div className="catsheet__counter">
          Entered: <b>{kg(entered)}</b> of <b>{kg(target)}</b>
          {" — "}
          {balanced ? (
            <span className="catsheet__balanced"><Check size={14} aria-hidden="true" /> balanced</span>
          ) : remaining > 0 ? (
            <>Remaining: <b>{kg(remaining)}</b></>
          ) : (
            <span className="catsheet__over">Over by <b>{kg(Math.abs(remaining))}</b></span>
          )}
        </div>

        <div className="u-row">
          {onCancel && (
            <Button variant="secondary" onClick={onCancel} disabled={saving}>
              <X size={15} aria-hidden="true" />Cancel
            </Button>
          )}
          <Button onClick={submit} disabled={!balanced || saving}>
            {saving ? "Saving…" : "Submit categories"}
          </Button>
        </div>
      </footer>
    </div>
  );
}
