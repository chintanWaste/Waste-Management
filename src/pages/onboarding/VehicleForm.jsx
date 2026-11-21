import { useState } from "react";
import Button from "../../components/common/Button";
import FileUpload from "../../components/common/FileUpload";
import { SelectInput, TextInput } from "../../components/common/Field";
import { Banner } from "../../components/common/States";
import { SETTING } from "../../config/appConfig";
import { useAuth } from "../../context/AuthContext";
import { useSettings } from "../../context/SettingsContext";
import { useToast } from "../../context/ToastContext";
import { useForm } from "../../hooks/useForm";
import { createVehicle, nextCode } from "../../services/onboardingService";
import * as r from "../../utils/fieldRules";

const EMPTY = {
  Registration_Number: "", Engine_Number: "", Chassis_Number: "",
  Vehicle_Type: "", Vehicle_Model: "",
  Insurance_Validity_Date: "", PUC_Validity_Date: "",
  Fitness_Validity_Date: "", Registration_Validity_Date: "",
};

/** Section 10.1 — vehicle inventory entry. */
export default function VehicleForm({ existing, onCreated, onCancel }) {
  const { user } = useAuth();
  const { list, number } = useSettings();
  const toast = useToast();
  const [documents, setDocuments] = useState(null);

  const form = useForm({
    initialValues: EMPTY,
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
      Documents: r.requiredFile("The documents PDF", documents),
    },
    onSubmit: async (values, { reset }) => {
      const code = await createVehicle({ values, documents, user });
      reset();
      setDocuments(null);
      toast.success(`Vehicle ${code} created`, `${values.Registration_Number} is now in the inventory.`);
      onCreated?.(code);
    },
  });

  const { field, values, setValue, errorFor, isValid, submitting, submitError } = form;
  const isElectric = values.Vehicle_Type === "Electric";

  return (
    <>
      <form onSubmit={form.handleSubmit} noValidate>
        {submitError && (
          <div style={{ marginBottom: 16 }}><Banner tone="danger">{submitError}</Banner></div>
        )}

        <div className="formsection">
          <div className="formsection__title">Vehicle</div>
          <div className="formgrid">
            <TextInput label="Vehicle Code" value={nextCode(existing, "Vehicle_Code", "VH")} disabled hint="Generated automatically" />
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
            label="Documents" required
            maxMb={number(SETTING.maxUploadMb, 5)}
            helpText="Upload one PDF (max 5 MB) containing: registration certificate (RC), insurance certificate, PUC certificate (not for electric vehicles), fitness certificate, and any other permit."
            value={documents} error={errorFor("Documents")} onChange={setDocuments}
          />
        </div>

        <div className="formactions">
          <Button type="button" variant="secondary" onClick={() => { form.reset(); setDocuments(null); onCancel?.(); }}>
            Cancel
          </Button>
          <Button type="submit" disabled={!isValid || submitting}>
            {submitting ? "Adding…" : "Add vehicle"}
          </Button>
        </div>
      </form>
    </>
  );
}
