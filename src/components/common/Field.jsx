import { Search } from "lucide-react";
import { useId } from "react";

/** Labelled wrapper used by every form control. */
export function Field({ label, required = false, error, hint, children }) {
  return (
    <div className="field">
      {label && (
        <label className="field__label">
          {label}
          {required && <span className="req">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <span className="field__error">{error}</span>
      ) : (
        hint && <span className="field__hint">{hint}</span>
      )}
    </div>
  );
}

export function TextInput({ label, required, error, hint, ...rest }) {
  const id = useId();
  return (
    <Field label={label} required={required} error={error} hint={hint}>
      <input id={id} className={`input ${error ? "input--error" : ""}`} {...rest} />
    </Field>
  );
}

/**
 * A dropdown whose options come from the Settings tab.
 *
 * When the list is empty the control says so rather than looking broken —
 * an empty dropdown almost always means the Settings row is missing.
 */
export function SelectInput({
  label, required, error, hint, options = [],
  placeholder = "Select…", emptyHint, ...rest
}) {
  const empty = options.length === 0;

  return (
    <Field
      label={label}
      required={required}
      error={error}
      hint={empty ? emptyHint || "No options are configured for this list yet" : hint}
    >
      <select
        className={`select ${error ? "select--error" : ""} ${empty ? "select--empty" : ""}`}
        {...rest}
        disabled={rest.disabled || empty}
      >
        <option value="">{empty ? "No options available" : placeholder}</option>
        {options.map((opt) => {
          const value = typeof opt === "string" ? opt : opt.value;
          const text = typeof opt === "string" ? opt : opt.label;
          return (
            <option key={value} value={value}>
              {text}
            </option>
          );
        })}
      </select>
    </Field>
  );
}

export function TextArea({ label, required, error, hint, ...rest }) {
  return (
    <Field label={label} required={required} error={error} hint={hint}>
      <textarea className="textarea" {...rest} />
    </Field>
  );
}

export function SearchBox({ value, onChange, placeholder = "Search…" }) {
  return (
    <div className="search">
      <Search className="search__icon" size={15} aria-hidden="true" />
      <input
        className="input"
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
