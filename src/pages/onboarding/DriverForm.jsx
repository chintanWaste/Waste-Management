import { useState } from "react";
import Button from "../../components/common/Button";
import FileUpload from "../../components/common/FileUpload";
import { TextInput } from "../../components/common/Field";
import { Banner } from "../../components/common/States";
import { SETTING } from "../../config/appConfig";
import { useAuth } from "../../context/AuthContext";
import { useSettings } from "../../context/SettingsContext";
import { useToast } from "../../context/ToastContext";
import { useForm } from "../../hooks/useForm";
import { createDriver, nextCode } from "../../services/onboardingService";
import * as r from "../../utils/fieldRules";

const EMPTY = {
  Driver_Name: "", Licence_Number: "", Contact_Number: "", Licence_Validity_Date: "",
};

/** Section 10.2 — driver inventory entry. */
export default function DriverForm({ existing, onCreated, onCancel }) {
  const { user } = useAuth();
  const { number } = useSettings();
  const toast = useToast();
  const [documents, setDocuments] = useState(null);

  const form = useForm({
    initialValues: EMPTY,
    rules: {
      Driver_Name: r.personName("Driver Name"),
      Licence_Number: r.licenceNumber(),
      Contact_Number: r.phone("Contact Number"),
      Licence_Validity_Date: r.futureDate("Driving Licence Validity Date"),
      Licence: r.requiredFile("The driving licence copy", documents),
    },
    onSubmit: async (values, { reset }) => {
      const code = await createDriver({ values, documents, user });
      reset();
      setDocuments(null);
      toast.success(`Driver ${code} created`, `${values.Driver_Name} is now in the inventory.`);
      onCreated?.(code);
    },
  });

  const { field, setValue, errorFor, isValid, submitting, submitError } = form;

  return (
    <>
      <form onSubmit={form.handleSubmit} noValidate>
        {submitError && (
          <div style={{ marginBottom: 16 }}><Banner tone="danger">{submitError}</Banner></div>
        )}

        <div className="formsection">
          <div className="formgrid">
            <TextInput label="Driver Code" value={nextCode(existing, "Driver_Code", "DR")} disabled hint="Generated automatically" />
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
            label="Driving Licence Copy" required
            maxMb={number(SETTING.maxUploadMb, 5)}
            helpText="Upload a scan of the driving licence as one PDF."
            value={documents} error={errorFor("Licence")} onChange={setDocuments}
          />
        </div>

        <div className="formactions">
          <Button type="button" variant="secondary" onClick={() => { form.reset(); setDocuments(null); onCancel?.(); }}>
            Cancel
          </Button>
          <Button type="submit" disabled={!isValid || submitting}>
            {submitting ? "Adding…" : "Add driver"}
          </Button>
        </div>
      </form>
    </>
  );
}
