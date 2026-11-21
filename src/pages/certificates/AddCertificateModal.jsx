import { useState } from "react";
import Button from "../../components/common/Button";
import FileUpload from "../../components/common/FileUpload";
import { TextInput } from "../../components/common/Field";
import Modal from "../../components/common/Modal";
import { Banner } from "../../components/common/States";
import { SETTING } from "../../config/appConfig";
import { useAuth } from "../../context/AuthContext";
import { useSettings } from "../../context/SettingsContext";
import { useToast } from "../../context/ToastContext";
import { addVendorCertificate } from "../../services/certificateService";
import { kg, today } from "../../utils/format";

/** Section 15.1 — record a certificate received from a vendor. */
export default function AddCertificateModal({
  open, vendorCode, vendorName, row, certificateGroups, onClose, onSaved,
}) {
  const { user } = useAuth();
  const { number } = useSettings();
  const toast = useToast();

  const [values, setValues] = useState({
    Certificate_Number: "", Certificate_Date: today(), Quantity_Certified_Kg: "",
  });
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

  const pending = row?.pending ?? 0;
  const quantity = Number(values.Quantity_Certified_Kg);
  const overPending = quantity > pending + 0.005;
  const futureDate = values.Certificate_Date > today();

  const ready =
    values.Certificate_Number.trim() &&
    values.Certificate_Date && !futureDate &&
    quantity > 0 && !overPending &&
    file;

  const reset = () => {
    setValues({ Certificate_Number: "", Certificate_Date: today(), Quantity_Certified_Kg: "" });
    setFile(null);
    setError("");
  };

  const close = () => { reset(); onClose(); };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await addVendorCertificate({
        vendorCode,
        values: { ...values, Material_Group: row.group },
        file, certificateGroups, user,
      });
      toast.success(
        `Certificate ${values.Certificate_Number} recorded`,
        `${kg(quantity)} of ${row.group} certified by ${vendorCode}.`
      );
      reset();
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!row) return null;

  return (
    <Modal
      open={open}
      title="Add Certificate"
      subtitle={`${row.group} · ${vendorCode} — ${vendorName || ""}`}
      size="md"
      onClose={close}
    >
      <form onSubmit={submit} noValidate>
        {error && (
          <div style={{ marginBottom: 16 }}><Banner tone="danger">{error}</Banner></div>
        )}

        <div className="certsummary">
          <div>
            <span className="u-small u-muted">Dispatched</span>
            <b>{kg(row.dispatched)}</b>
          </div>
          <div>
            <span className="u-small u-muted">Already certified</span>
            <b>{kg(row.certified)}</b>
          </div>
          <div>
            <span className="u-small u-muted">Pending</span>
            <b className={pending > 0 ? "u-pending" : "u-done"}>{kg(pending)}</b>
          </div>
        </div>

        <div className="formgrid" style={{ marginTop: 16 }}>
          <TextInput
            label="Certificate Number" required
            placeholder="e.g. C-101"
            hint="Must be unique for this vendor"
            value={values.Certificate_Number} onChange={set("Certificate_Number")}
          />
          <TextInput
            label="Certificate Date" required type="date" max={today()}
            error={futureDate ? "The date cannot be in the future" : ""}
            value={values.Certificate_Date} onChange={set("Certificate_Date")}
          />
          <TextInput
            label="Quantity Certified (kg)" required inputMode="decimal"
            placeholder="0.00"
            error={overPending ? `Cannot exceed the ${kg(pending)} pending` : ""}
            hint={`Up to ${kg(pending)}`}
            value={values.Quantity_Certified_Kg} onChange={set("Quantity_Certified_Kg")}
          />
        </div>

        <div className="formsection">
          <FileUpload
            label="Certificate PDF" required
            maxMb={number(SETTING.maxUploadMb, 5)}
            helpText="Upload the processing certificate received from the vendor."
            value={file} onChange={setFile}
          />
        </div>

        <div className="formactions">
          <Button type="button" variant="secondary" onClick={close} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={!ready || saving}>
            {saving ? "Saving…" : "Submit certificate"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
