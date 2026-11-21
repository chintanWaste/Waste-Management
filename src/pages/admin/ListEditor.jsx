import { useState } from "react";
import { Lock, Plus, RotateCcw, X } from "lucide-react";
import Badge from "../../components/common/Badge";
import Button from "../../components/common/Button";
import Card from "../../components/common/Card";

/**
 * Edits one dropdown list — the values behind Vendor Type, BWG Type, MoU Type
 * and the rest (section 17.4).
 *
 * Values are held as chips; saving writes them back to the Settings tab as one
 * pipe-separated cell. A list the specification fixes is shown read-only.
 */
export default function ListEditor({ listKey, meta, values, source, onSave, saving }) {
  const [draft, setDraft] = useState(null); // null until the first edit
  const [entry, setEntry] = useState("");
  const [editingAt, setEditingAt] = useState(-1);
  const [editText, setEditText] = useState("");

  const current = draft ?? values;
  const dirty = draft !== null && draft.join("|") !== values.join("|");
  const locked = Boolean(meta.fixed);

  const commit = (next) => setDraft(next);

  const add = () => {
    const text = entry.trim();
    if (!text) return;
    if (current.some((v) => v.toLowerCase() === text.toLowerCase())) {
      setEntry("");
      return;
    }
    commit([...current, text]);
    setEntry("");
  };

  const remove = (index) => commit(current.filter((_, i) => i !== index));

  const rename = (index) => {
    const text = editText.trim();
    if (!text) return;
    const next = [...current];
    next[index] = text;
    commit(next);
    setEditingAt(-1);
  };

  const move = (index, by) => {
    const target = index + by;
    if (target < 0 || target >= current.length) return;
    const next = [...current];
    [next[index], next[target]] = [next[target], next[index]];
    commit(next);
  };

  const SOURCE_BADGE = {
    sheet: { tone: "ok", text: "From your Sheet" },
    default: { tone: "info", text: "Built-in default" },
    fixed: { tone: "muted", text: "Fixed by the specification" },
  }[source];

  return (
    <Card
      title={meta.label}
      subtitle={meta.description}
      actions={
        <div className="u-row">
          <Badge tone={SOURCE_BADGE.tone}>
            {locked && <Lock size={10} aria-hidden="true" />}
            {SOURCE_BADGE.text}
          </Badge>
          {dirty && (
            <>
              <Button size="sm" variant="secondary" onClick={() => setDraft(null)} disabled={saving}>
                <RotateCcw size={13} aria-hidden="true" />
                Undo
              </Button>
              <Button size="sm" onClick={() => onSave(listKey, current)} disabled={saving || !current.length}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </>
          )}
        </div>
      }
    >
      <div className="chips">
        {current.map((value, index) =>
          editingAt === index ? (
            <span className="chip chip--editing" key={`${value}-${index}`}>
              <input
                className="chip__input"
                value={editText}
                autoFocus
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); rename(index); }
                  if (e.key === "Escape") setEditingAt(-1);
                }}
                onBlur={() => rename(index)}
              />
            </span>
          ) : (
            <span className={`chip ${locked ? "chip--locked" : ""}`} key={`${value}-${index}`}>
              {!locked && (
                <button
                  type="button" className="chip__move" title="Move earlier"
                  onClick={() => move(index, -1)} disabled={index === 0}
                >
                  ‹
                </button>
              )}

              <button
                type="button"
                className="chip__label"
                disabled={locked}
                title={locked ? "This list cannot be changed" : "Click to rename"}
                onClick={() => { setEditingAt(index); setEditText(value); }}
              >
                {value}
              </button>

              {!locked && (
                <>
                  <button
                    type="button" className="chip__move" title="Move later"
                    onClick={() => move(index, 1)} disabled={index === current.length - 1}
                  >
                    ›
                  </button>
                  <button
                    type="button" className="chip__remove" title="Remove"
                    onClick={() => remove(index)}
                  >
                    <X size={11} aria-hidden="true" />
                  </button>
                </>
              )}
            </span>
          )
        )}
      </div>

      {locked ? (
        <p className="field__hint" style={{ marginTop: 12 }}>
          Specification section {meta.spec}. Changing these would break the figures
          already recorded against them.
        </p>
      ) : (
        <>
          <div className="chipadd">
            <input
              className="input"
              placeholder={`Add another ${meta.label.toLowerCase().replace(/s$/, "")}…`}
              value={entry}
              onChange={(e) => setEntry(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); add(); }
              }}
            />
            <Button variant="secondary" onClick={add} disabled={!entry.trim()}>
              <Plus size={14} aria-hidden="true" />
              Add
            </Button>
          </div>

          <p className="field__hint" style={{ marginTop: 10 }}>
            Section {meta.spec} · {current.length} value{current.length === 1 ? "" : "s"} ·
            {" "}Click a value to rename it, ‹ › to reorder, × to remove.
            {source === "default" && " Saving writes this list into your Google Sheet for the first time."}
          </p>
        </>
      )}
    </Card>
  );
}
