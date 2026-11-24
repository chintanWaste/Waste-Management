import { useEffect, useMemo, useRef, useState } from "react";
import Button from "../../components/common/Button";
import FileUpload from "../../components/common/FileUpload";
import { SelectInput, TextInput } from "../../components/common/Field";
import { Banner } from "../../components/common/States";
import { SETTING } from "../../config/appConfig";
import { useAuth } from "../../context/AuthContext";
import { useSettings } from "../../context/SettingsContext";
import { useToast } from "../../context/ToastContext";
import { useForm } from "../../hooks/useForm";
import { viewUrl } from "../../services/drive";
import { createVehicle, nextCode, updateVehicle } from "../../services/onboardingService";
import * as r from "../../utils/fieldRules";

const EMPTY = {
  Registration_Number: "", Engine_Number: "", Chassis_Number: "",
  Vehicle_Type: "", Vehicle_Model: "",
  Insurance_Validity_Date: "", PUC_Validity_Date: "",
  Fitness_Validity_Date: "", Registration_Validity_Date: "",
};

/** Fill the form from a vehicle row, for editing. */
export function vehicleToForm(row = {}) {
  const out = { ...EMPTY };
  for (const key of Object.keys(EMPTY)) out[key] = String(row[key] ?? "");
  return out;
}

/**
 * Section 10.1 — vehicle inventory entry.
 *
 * Passing `vehicle` switches to editing that row: fields start filled, the
 * code is fixed, and the PDF becomes optional because one is already on file.
 */
export default function VehicleForm({ vehicle, existing, onCreated, onCancel, onBusyChange }) {
  const { user } = useAuth();
  const { list, number } = useSettings();
  const toast = useToast();
  const [documents, setDocuments] = useState(null);

  const editing = Boolean(vehicle);
  const editCode = vehicle?.Vehicle_Code || "";
  const existingDocuments = editing ? viewUrl(vehicle.Documents_File_Id) : "";

  const initialValues = useMemo(
    () => (editing ? vehicleToForm(vehicle) : EMPTY),
    [editing, vehicle]
  );

  const form = useForm({
    initialValues,
    rules: {
      Registration_Number: r.vehicleNumber(),
      Engine_Number: r.machineNumber("Engine Number"),
      Chassis_Number: r.machineNumber("Chassis Number", { min: 6, max: 25 }),
      Vehicle_Type: r.choice("Type of Vehicle", list(SETTING.vehicleTypes)),
      Vehicle_Model: r.orgName("Model of Vehicle", { max: 60 }),
      Insurance_Validity_Date: r.futureDate("Insurance Validity Date"),
      // PUC is not applicable to an electric vehicle (section 10.1).
      PUC_Validity_Date: r.when(
        (all) => all.Vehicle_Type !== "Electric",
        r.futureDate("PUC Validity Date")
      ),
      Fitness_Validity_Date: r.futureDate("Fitness Validity Date"),
      Registration_Validity_Date: r.futureDate("Registration Validity Date"),
      // Already on file when editing: a new one replaces it, none keeps it.
      Documents: editing ? () => "" : r.requiredFile("The documents PDF", documents),
    },
    onSubmit: async (values, { reset }) => {
      const { code, row } = editing
        ? await updateVehicle({ code: editCode, values, documents, existing: vehicle, user })
        : await createVehicle({ values, documents, user });

      reset();
      setDocuments(null);
      toast.success(
        editing ? `Vehicle ${code} updated` : `Vehicle ${code} created`,
        `${values.Registration_Number} is ${editing ? "saved" : "now in the inventory"}.`
      );
      onCreated?.({ code, row });
    },
  });

  const { field, values, setValue, errorFor, isValid, submitting, submitError } = form;
  const isElectric = values.Vehicle_Type === "Electric";

  useEffect(() => {
    onBusyChange?.(submitting);
  }, [submitting, onBusyChange]);

  /** The button is at the foot of the form; the banner is at its head. */
  const errorRef = useRef(null);
  useEffect(() => {
    if (!submitError) return;
    errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    toast.error(editing ? "Vehicle not updated" : "Vehicle not created", submitError);
  }, [submitError, toast, editing]);

  return (
    <>
      <form onSubmit={form.handleSubmit} noValidate>
        {submitError && (
          <div ref={errorRef} style={{ marginBottom: 16 }}><Banner tone="danger">{submitError}</Banner></div>
        )}

        <div className="formsection">
          <div className="formsection__title">Vehicle</div>
          <div className="formgrid">
            <TextInput
              label="Vehicle Code"
              value={editing ? editCode : nextCode(existing, "Vehicle_Code", "VH")}
              disabled
              hint={editing ? "The code never changes" : "Generated automatically"}
            />
            <TextInput
              label="Registration Number" required maxLength={13} placeholder="DL01AB1234"
              style={{ textTransform: "uppercase" }}
              {...field("Registration_Number")}
              onChange={(e) => setValue("Registration_Number", e.target.value.toUpperCase())}
            />
            <TextInput label="Engine Number" required style={{ textTransform: "uppercase" }} {...field("Engine_Number")} />
            <TextInput label="Chassis Number" required style={{ textTransform: "uppercase" }} {...field("Chassis_Number")} />
            <SelectInput label="Type of Vehicle" required options={list(SETTING.vehicleTypes)} {...field("Vehicle_Type")} />
            <TextInput label="Model of Vehicle" required placeholder="e.g. Mahindra Treo Zor" {...field("Vehicle_Model")} />
          </div>
        </div>

        <div className="formsection">
          <div className="formsection__title">Document validity</div>
          <div className="formgrid">
            <TextInput label="Insurance Validity Date" required type="date" {...field("Insurance_Validity_Date")} />

            {isElectric ? (
              <TextInput label="PUC Validity Date" value="Not applicable" disabled hint="Electric vehicles do not need a PUC certificate" />
            ) : (
              <TextInput label="PUC Validity Date" required type="date" {...field("PUC_Validity_Date")} />
            )}

            <TextInput label="Fitness Validity Date" required type="date" {...field("Fitness_Validity_Date")} />
            <TextInput label="Registration Validity Date" required type="date" {...field("Registration_Validity_Date")} />
          </div>
          <p className="field__hint" style={{ marginTop: 10 }}>
            A vehicle whose insurance, PUC, fitness or registration has expired on the
            collection date cannot be selected in inward entry.
          </p>
        </div>

        <div className="formsection">
          <div className="formsection__title">Documents</div>
          <FileUpload
            label="Documents"
            required={!editing}
            maxMb={number(SETTING.maxUploadMb, 5)}
            helpText={
              editing && existingDocuments
                ? "A PDF is already on file. Choose one only to replace it."
                : "Upload one PDF (max 5 MB) containing: registration certificate (RC), insurance certificate, PUC certificate (not for electric vehicles), fitness certificate, and any other permit."
            }
            value={documents}
            error={errorFor("Documents")}
            onChange={setDocuments}
            existingUrl={existingDocuments}
            existingLabel={`${editCode} documents PDF`}
          />
        </div>

        <div className="formactions">
          <Button type="button" variant="secondary" onClick={() => { form.reset(); setDocuments(null); onCancel?.(); }}>
            Cancel
          </Button>
          <Button type="submit" disabled={!isValid || submitting}>
            {submitting
              ? (editing ? "Saving…" : "Adding…")
              : (editing ? "Save changes" : "Add vehicle")}
          </Button>
        </div>
      </form>
    </>
  );
}
