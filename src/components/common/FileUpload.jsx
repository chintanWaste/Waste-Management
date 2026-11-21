import { FileText, Info, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import { Field } from "./Field";

/**
 * Single-file upload with a size limit (section 4.5).
 * The file is held in state until the form is submitted; only then is it
 * uploaded to Drive, so an abandoned form leaves nothing behind.
 */
export default function FileUpload({
  label,
  required,
  error,
  helpText,
  accept = "application/pdf",
  maxMb = 5,
  value,
  onChange,
}) {
  const inputRef = useRef(null);
  const [sizeError, setSizeError] = useState("");
  const [dragging, setDragging] = useState(false);

  const take = (file) => {
    if (!file) return;

    if (accept && !accept.split(",").some((t) => file.type === t.trim())) {
      setSizeError(`Only ${accept.includes("pdf") ? "PDF" : "image"} files are accepted`);
      return;
    }
    if (file.size > maxMb * 1024 * 1024) {
      setSizeError(
        `This file is ${(file.size / 1048576).toFixed(1)} MB. The limit is ${maxMb} MB.`
      );
      return;
    }

    setSizeError("");
    onChange(file);
  };

  const clear = () => {
    setSizeError("");
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <Field label={label} required={required} error={error || sizeError}>
      {helpText && (
        <div className="upload__help">
          <Info size={15} aria-hidden="true" style={{ flex: "0 0 auto", marginTop: 1 }} />
          <span>{helpText}</span>
        </div>
      )}

      {value ? (
        <div className="upload__file">
          <FileText size={20} aria-hidden="true" style={{ color: "var(--c-brand-700)", flex: "0 0 auto" }} />
          <div className="u-grow">
            <div className="upload__filename">{value.name}</div>
            <div className="u-small u-muted">{(value.size / 1048576).toFixed(2)} MB</div>
          </div>
          <button type="button" className="btn btn--ghost btn--sm" onClick={clear}>
            Remove
          </button>
        </div>
      ) : (
        <div
          className={`upload__drop ${dragging ? "upload__drop--over" : ""} ${
            error || sizeError ? "upload__drop--error" : ""
          }`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            take(e.dataTransfer.files?.[0]);
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
        >
          <UploadCloud className="upload__icon" size={24} strokeWidth={1.6} aria-hidden="true" />
          <div>
            <b>Click to choose a file</b> or drag it here
          </div>
          <div className="u-small u-muted">
            One {accept.includes("pdf") ? "PDF" : "file"}, maximum {maxMb} MB
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => take(e.target.files?.[0])}
      />
    </Field>
  );
}
