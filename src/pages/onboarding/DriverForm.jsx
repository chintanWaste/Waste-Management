import { useEffect, useMemo, useRef, useState } from "react";
import Button from "../../components/common/Button";
import FileUpload from "../../components/common/FileUpload";
import { TextInput } from "../../components/common/Field";
import { Banner } from "../../components/common/States";
import { SETTING } from "../../config/appConfig";
import { useAuth } from "../../context/AuthContext";
import { useSettings } from "../../context/SettingsContext";
import { useToast } from "../../context/ToastContext";
import { useForm } from "../../hooks/useForm";
import { viewUrl } from "../../services/drive";
import { createDriver, nextCode, updateDriver } from "../../services/onboardingService";
import * as r from "../../utils/fieldRules";

const EMPTY = {
  Driver_Name: "", Licence_Number: "", Contact_Number: "", Licence_Validity_Date: "",
};

/** Fill the form from a driver row, for editing. */
export function driverToForm(row = {}) {
  const out = { ...EMPTY };
  for (const key of Object.keys(EMPTY)) out[key] = String(row[key] ?? "");
  return out;
}

/**
 * Section 10.2 — driver inventory entry.
 *
 * Passing `driver` switches to editing that row.
 */
export default function DriverForm({ driver, existing, onCreated, onCancel, onBusyChange }) {
  const { user } = useAuth();
  const { number } = useSettings();
  const toast = useToast();
  const [documents, setDocuments] = useState(null);

  const editing = Boolean(driver);
  const editCode = driver?.Driver_Code || "";
  const existingLicence = editing ? viewUrl(driver.Licence_File_Id) : "";

  const initialValues = useMemo(
    () => (editing ? driverToForm(driver) : EMPTY),
    [editing, driver]
  );

  const form = useForm({
    initialValues,
    rules: {
      Driver_Name: r.personName("Driver Name"),
      Licence_Number: r.licenceNumber(),
      Contact_Number: r.phone("Contact Number"),
      Licence_Validity_Date: r.futureDate("Driving Licence Validity Date"),
      // Already on file when editing: a new one replaces it, none keeps it.
      Licence: editing ? () => "" : r.requiredFile("The driving licence copy", documents),
    },
    onSubmit: async (values, { reset }) => {
      const { code, row } = editing
        ? await updateDriver({ code: editCode, values, documents, existing: driver, user })
        : await createDriver({ values, documents, user });

      reset();
      setDocuments(null);
      toast.success(
        editing ? `Driver ${code} updated` : `Driver ${code} created`,
        `${values.Driver_Name} is ${editing ? "saved" : "now in the inventory"}.`
      );
      onCreated?.({ code, row });
    },
  });

  const { field, setValue, errorFor, isValid, submitting, submitError } = form;

  useEffect(() => {
    onBusyChange?.(submitting);
  }, [submitting, onBusyChange]);

  const errorRef = useRef(null);
  useEffect(() => {
    if (!submitError) return;
    errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    toast.error(editing ? "Driver not updated" : "Driver not created", submitError);
  }, [submitError, toast, editing]);

  return (
    <>
      <form onSubmit={form.handleSubmit} noValidate>
        {submitError && (
          <div ref={errorRef} style={{ marginBottom: 16 }}><Banner tone="danger">{submitError}</Banner></div>
        )}

        <div className="formsection">
          <div className="formgrid">
            <TextInput
              label="Driver Code"
              value={editing ? editCode : nextCode(existing, "Driver_Code", "DR")}
              disabled
              hint={editing ? "The code never changes" : "Generated automatically"}
            />
            <TextInput label="Driver Name" required {...field("Driver_Name")} />
            <TextInput
              label="Driving Licence Number" required
              hint="Must be unique"
              style={{ textTransform: "uppercase" }}
              {...field("Licence_Number")}
              onChange={(e) => setValue("Licence_Number", e.target.value.toUpperCase())}
            />
            <TextInput label="Contact Number" required inputMode="tel" {...field("Contact_Number")} />
            <TextInput
              label="Driving Licence Validity Date" required type="date"
              hint="A driver whose licence has expired on the collection date cannot be selected"
              {...field("Licence_Validity_Date")}
            />
          </div>
        </div>

        <div className="formsection">
          <div className="formsection__title">Documents</div>
          <FileUpload
            label="Driving Licence Copy"
            required={!editing}
            maxMb={number(SETTING.maxUploadMb, 5)}
            helpText={
              editing && existingLicence
                ? "A licence copy is already on file. Choose one only to replace it."
                : "Upload a scan of the driving licence as one PDF."
            }
            value={documents}
            error={errorFor("Licence")}
            onChange={setDocuments}
            existingUrl={existingLicence}
            existingLabel={`${editCode} licence copy`}
          />
        </div>

        <div className="formactions">
          <Button type="button" variant="secondary" onClick={() => { form.reset(); setDocuments(null); onCancel?.(); }}>
            Cancel
          </Button>
          <Button type="submit" disabled={!isValid || submitting}>
            {submitting
              ? (editing ? "Saving…" : "Adding…")
              : (editing ? "Save changes" : "Add driver")}
          </Button>
        </div>
      </form>
    </>
  );
}
