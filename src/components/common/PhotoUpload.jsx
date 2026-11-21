import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { Field } from "./Field";

/**
 * Several photos with a combined size limit (section 4.5).
 *
 * The screen stops the user once the limit is reached, so they upload fewer
 * photos that fit rather than being told after the fact.
 */
export default function PhotoUpload({
  label = "Photos",
  required,
  error,
  maxFiles = 5,
  maxTotalMb = 5,
  value = [],
  onChange,
}) {
  const inputRef = useRef(null);
  const [message, setMessage] = useState("");

  const usedBytes = value.reduce((sum, f) => sum + f.size, 0);
  const usedMb = usedBytes / 1048576;
  const remainingMb = Math.max(0, maxTotalMb - usedMb);

  const add = (files) => {
    const incoming = [...files].filter((f) => f.type.startsWith("image/"));
    if (!incoming.length) {
      setMessage("Only JPG or PNG images can be uploaded.");
      return;
    }

    const accepted = [];
    let runningBytes = usedBytes;

    for (const file of incoming) {
      if (value.length + accepted.length >= maxFiles) {
        setMessage(`Up to ${maxFiles} photos. The rest were not added.`);
        break;
      }
      if ((runningBytes + file.size) / 1048576 > maxTotalMb) {
        setMessage(
          `The total must stay under ${maxTotalMb} MB. ` +
            `"${file.name}" did not fit — upload fewer photos.`
        );
        break;
      }
      accepted.push(file);
      runningBytes += file.size;
    }

    if (accepted.length) {
      setMessage((m) => (accepted.length === incoming.length ? "" : m));
      onChange([...value, ...accepted]);
    }
    if (inputRef.current) inputRef.current.value = "";
  };

  const remove = (index) => {
    setMessage("");
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <Field label={label} required={required} error={error || message}>
      <div className="photos">
        {value.map((file, i) => (
          <figure key={`${file.name}-${i}`} className="photo">
            <img src={URL.createObjectURL(file)} alt="" />
            <button type="button" className="photo__remove" onClick={() => remove(i)} aria-label={`Remove photo ${i + 1}`}>
              <X size={12} aria-hidden="true" />
            </button>
            <figcaption>{(file.size / 1048576).toFixed(1)} MB</figcaption>
          </figure>
        ))}

        {value.length < maxFiles && remainingMb > 0.05 && (
          <button type="button" className="photo photo--add" onClick={() => inputRef.current?.click()}>
            <ImagePlus size={20} aria-hidden="true" />
            <span className="u-small">Add photo</span>
          </button>
        )}
      </div>

      <div className="u-small u-muted">
        {value.length} of {maxFiles} photos · {usedMb.toFixed(1)} MB of {maxTotalMb} MB used
      </div>

      <input
        ref={inputRef} type="file" accept="image/jpeg,image/png" multiple hidden
        onChange={(e) => add(e.target.files)}
      />
    </Field>
  );
}
