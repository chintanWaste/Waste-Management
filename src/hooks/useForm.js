import { useCallback, useMemo, useState } from "react";

/**
 * Form state with per-field validation.
 *
 * `rules` is { fieldName: (value, allValues) => errorMessage | "" }.
 * A field is only shown as wrong once it has been touched or a submit has been
 * attempted, so the form does not light up red before anything is typed.
 */
export function useForm({ initialValues, rules, onSubmit }) {
  const [values, setValues] = useState(initialValues);
  const [touched, setTouched] = useState({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const errors = useMemo(() => {
    const out = {};
    for (const [field, rule] of Object.entries(rules)) {
      const message = rule(values[field], values);
      if (message) out[field] = message;
    }
    return out;
  }, [values, rules]);

  const isValid = Object.keys(errors).length === 0;

  /**
   * The message to render under a field right now.
   *
   * Once a field has been left, or a submit has been attempted, every message
   * shows. Before that, only messages about what was actually typed show — a
   * digit in a name is wrong the moment it is typed, whereas "is required" or
   * "is too short" would just be nagging someone who is still typing.
   */
  const errorFor = useCallback(
    (field) => {
      const message = errors[field];
      if (!message) return "";
      if (touched[field] || submitAttempted) return message;

      const value = String(values[field] ?? "");
      if (!value) return "";
      if (/is required|too short|at least/i.test(message)) return "";
      return message;
    },
    [errors, touched, submitAttempted, values]
  );

  const setValue = useCallback((field, value) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  }, []);

  /** Change several fields at once, e.g. clearing GST number when GST = No. */
  const setMany = useCallback((patch) => {
    setValues((prev) => ({ ...prev, ...patch }));
  }, []);

  const blur = useCallback((field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }, []);

  const reset = useCallback(() => {
    setValues(initialValues);
    setTouched({});
    setSubmitAttempted(false);
    setSubmitError("");
  }, [initialValues]);

  const handleSubmit = useCallback(
    async (event) => {
      event?.preventDefault?.();
      setSubmitAttempted(true);
      setSubmitError("");

      if (Object.keys(errors).length > 0) {
        const first = Object.keys(errors)[0];
        document.querySelector(`[name="${first}"]`)?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        return;
      }

      setSubmitting(true);
      try {
        await onSubmit(values, { reset });
      } catch (err) {
        setSubmitError(err.message || "Could not save. Please try again.");
      } finally {
        setSubmitting(false);
      }
    },
    [errors, onSubmit, values, reset]
  );

  return {
    values, errors, errorFor, isValid, submitting, submitError,
    setValue, setMany, blur, reset, handleSubmit,
    /** Spread onto an input: value, name, onChange, onBlur. */
    field: (name) => ({
      name,
      value: values[name] ?? "",
      onChange: (e) => setValue(name, e.target.value),
      onBlur: () => blur(name),
      error: errorFor(name),
    }),
  };
}
