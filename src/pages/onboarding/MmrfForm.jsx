import { useEffect, useMemo, useRef, useState } from "react";
import Button from "../../components/common/Button";
import FileUpload from "../../components/common/FileUpload";
import { SelectInput, TextArea, TextInput } from "../../components/common/Field";
import { Banner } from "../../components/common/States";
import { SETTING } from "../../config/appConfig";
import { useAuth } from "../../context/AuthContext";
import { useSettings } from "../../context/SettingsContext";
import { useToast } from "../../context/ToastContext";
import { useForm } from "../../hooks/useForm";
import { viewUrl } from "../../services/drive";
import { createMmrf, nextCode, updateMmrf } from "../../services/onboardingService";
import * as r from "../../utils/fieldRules";

export const EMPTY_MMRF = {
  MMRF_Name: "", Location: "", Area: "", Operation_Type: "", Complete_Address: "",
  In_Charge_Name: "", Contact_Number: "", Email: "",
  Capacity_Kg_Per_Day: "", Number_Of_Workers: "", Supervised_By: "",
};

/** Fill the form from an MMRF row, for editing. */
export function mmrfToForm(row = {}) {
  const out = { ...EMPTY_MMRF };
  for (const key of Object.keys(EMPTY_MMRF)) out[key] = String(row[key] ?? "");
  return out;
}

/**
 * Create or edit an MMRF / RRR Centre — specification section 9.
 *
 * Passing `mmrf` switches to editing that row: the fields start filled, the
 * code is fixed, and the MoU becomes optional because one is already on file.
 */
export default function MmrfForm({ mmrf, rows = [], onSaved, onCancel, onBusyChange }) {
  const { user } = useAuth();
  const { list, number } = useSettings();
  const toast = useToast();

  const editing = Boolean(mmrf);
  const editCode = mmrf?.MMRF_Code || "";
  const existingMou = editing ? viewUrl(mmrf.MoU_File_Id) : "";

  const [documents, setDocuments] = useState(null);

  const initialValues = useMemo(
    () => (editing ? mmrfToForm(mmrf) : EMPTY_MMRF),
    [editing, mmrf]
  );

  const form = useForm({
    initialValues,
    rules: {
      MMRF_Name: r.orgName("MMRF / RRR Centre Name", { max: 120 }),
      Location: r.placeName("Location"),
      Area: r.choice("Area", list(SETTING.areas)),
      Operation_Type: r.choice("Operation Type", list(SETTING.operationTypes)),
      Complete_Address: r.address("Complete Address"),
      In_Charge_Name: r.personName("MMRF In-charge"),
      Contact_Number: r.phone("Contact Number"),
      Email: r.email("Email Address", { required: false }),
      Capacity_Kg_Per_Day: r.capacity("Capacity"),
      Number_Of_Workers: r.wholeNumber("Number of Workers", { min: 1, max: 5000 }),
      Supervised_By: r.personName("Supervised By"),
      // Already on file when editing: a new one replaces it, none keeps it.
      MoU: editing ? () => "" : r.requiredFile("The MoU PDF", documents),
    },
    onSubmit: async (values, { reset }) => {
      const { code, row } = editing
        ? await updateMmrf({ code: editCode, values, documents, existing: mmrf, user })
        : await createMmrf({ values, documents, user });

      reset();
      setDocuments(null);
      toast.success(
        editing ? `${code} updated` : `${code} created`,
        editing
          ? `The changes to ${values.MMRF_Name} are saved.`
          : `${values.MMRF_Name} is now in the directory.`
      );
      onSaved?.({ code, row });
    },
  });

  const { field, errorFor, isValid, submitting, submitError, reset } = form;

  useEffect(() => {
    onBusyChange?.(submitting);
  }, [submitting, onBusyChange]);

  /** The button is at the foot of a long form; the banner is at its head. */
  const errorRef = useRef(null);
  useEffect(() => {
    if (!submitError) return;
    errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    toast.error(editing ? "Centre not updated" : "Centre not created", submitError);
  }, [submitError, toast, editing]);

  const cancel = () => {
    reset();
    setDocuments(null);
    onCancel?.();
  };

  return (
    <form onSubmit={form.handleSubmit} noValidate>
      {submitError && (
        <div ref={errorRef} style={{ marginBottom: 16 }}>
          <Banner tone="danger">{submitError}</Banner>
        </div>
      )}

      <div className="formsection">
        <div className="formsection__title">Centre Details</div>
        <div className="formgrid">
          <TextInput
            label="MMRF Code"
            value={editing ? editCode : nextCode(rows, "MMRF_Code", "MMRF")}
            disabled
            hint={editing ? "The code never changes" : "Generated automatically"}
          />
          <TextInput label="MMRF / RRR Centre Name" required hint="Must be unique within its area" {...field("MMRF_Name")} />
          <TextInput label="Location" required placeholder="Landmark or locality" {...field("Location")} />
          <SelectInput label="Area" required options={list(SETTING.areas)} {...field("Area")} />
          <SelectInput label="Operation Type" required options={list(SETTING.operationTypes)} {...field("Operation_Type")} />
          <div className="formgrid--full">
            <TextArea label="Complete Address" required rows={2} {...field("Complete_Address")} />
          </div>
        </div>
      </div>

      <div className="formsection">
        <div className="formsection__title">People and Capacity</div>
        <div className="formgrid">
          <TextInput label="MMRF In-charge" required {...field("In_Charge_Name")} />
          <TextInput label="Contact Number" required inputMode="tel" {...field("Contact_Number")} />
          <TextInput label="Email Address" type="email" hint="Optional" {...field("Email")} />
          <TextInput label="Capacity (kg/Day)" required inputMode="numeric" {...field("Capacity_Kg_Per_Day")} />
          <TextInput label="Number of Workers" required inputMode="numeric" {...field("Number_Of_Workers")} />
          <TextInput label="Supervised By" required {...field("Supervised_By")} />
        </div>
      </div>

      <div className="formsection">
        <div className="formsection__title">Documents</div>
        <FileUpload
          label="MoU with the MMRF In-charge"
          required={!editing}
          maxMb={number(SETTING.maxUploadMb, 5)}
          helpText={
            editing && existingMou
              ? "An MoU is already on file. Choose one only to replace it."
              : "Upload the signed MoU with the MMRF in-charge as one PDF."
          }
          value={documents}
          error={errorFor("MoU")}
          onChange={setDocuments}
          existingUrl={existingMou}
          existingLabel={`${editCode} MoU PDF`}
        />
      </div>

      <div className="formactions">
        <Button type="button" variant="secondary" onClick={cancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={!isValid || submitting}>
          {submitting
            ? (editing ? "Saving…" : "Creating…")
            : (editing ? "Save changes" : "Create centre")}
        </Button>
      </div>
    </form>
  );
}
