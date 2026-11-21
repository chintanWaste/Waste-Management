import { Check, Loader2, MapPin } from "lucide-react";
import { Field } from "./Field";
import { usePincodeLookup } from "../../hooks/usePincodeLookup";

/**
 * Pin code, with the district and state looked up as soon as six digits are in.
 *
 * Only the pin code leaves the browser. The lookup fills blank fields only, so
 * anything typed by hand is kept, and a failed lookup never blocks the form.
 */
export default function PinCodeField({
  label = "Pin Code",
  required = true,
  error,
  value,
  onChange,
  onBlur,
  onFill,
  stateOptions = [],
  name,
}) {
  const { status, result } = usePincodeLookup({
    pin: value,
    stateOptions,
    onResolve: onFill,
  });

  const hint = {
    loading: "Looking up the district and state…",
    missing: "That pin code was not found — fill in the state and district by hand.",
    error: "Could not reach the pin code service — fill in the state and district by hand.",
  }[status];

  return (
    <Field label={label} required={required} error={error}>
      <div className="pinfield">
        <input
          name={name}
          className={`input ${error ? "input--error" : ""}`}
          inputMode="numeric"
          maxLength={6}
          placeholder="110020"
          value={value}
          onChange={(e) => onChange({ target: { value: e.target.value.replace(/\D/g, "") } })}
          onBlur={onBlur}
        />
        {status === "loading" && <Loader2 className="pinfield__icon pinfield__icon--spin" size={15} aria-hidden="true" />}
        {status === "found" && <Check className="pinfield__icon pinfield__icon--ok" size={15} aria-hidden="true" />}
      </div>

      {status === "found" && result && (
        <span className="pinfield__found">
          <MapPin size={12} aria-hidden="true" />
          {result.district}
          {result.rawState ? `, ${result.rawState}` : ""}
          {result.offices?.length > 1 && (
            <span className="u-muted"> · {result.offices.length} localities</span>
          )}
        </span>
      )}

      {hint && <span className="field__hint">{hint}</span>}
    </Field>
  );
}
