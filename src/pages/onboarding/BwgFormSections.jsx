import { SelectInput, TextArea, TextInput } from "../../components/common/Field";
import { SETTING, YES_NO } from "../../config/appConfig";
import { useSettings } from "../../context/SettingsContext";

function Section({ title, children }) {
  return (
    <div className="formsection">
      <div className="formsection__title">{title}</div>
      <div className="formgrid">{children}</div>
    </div>
  );
}

/** Identity, area and address — section 8.1, first block. */
export function BwgIdentitySection({ form, nextCode }) {
  const { list } = useSettings();
  const { field, values } = form;

  return (
    <Section title="Generator Details">
      <TextInput
        label="BWG Code"
        value={nextCode}
        disabled
        hint="Generated automatically and never reused"
      />

      <TextInput
        label="BWG Name"
        required
        maxLength={150}
        placeholder="e.g. Hotel Imperial"
        {...field("BWG_Name")}
      />

      <SelectInput
        label="BWG Type"
        required
        options={list(SETTING.bwgTypes)}
        {...field("BWG_Type")}
      />

      {values.BWG_Type === "Others" && (
        <TextInput
          label="Please Describe the BWG Type"
          required
          placeholder="e.g. Sports complex"
          {...field("BWG_Type_Other")}
        />
      )}

      <SelectInput label="Area" required options={list(SETTING.areas)} {...field("Area")} />

      <SelectInput
        label="Operation Type"
        required
        options={list(SETTING.operationTypes)}
        {...field("Operation_Type")}
      />

      <TextInput
        label="Onboarding Date"
        required
        type="date"
        max={new Date().toISOString().slice(0, 10)}
        hint="Operations start date — the BWG appears in daily inward from this date"
        {...field("Onboarding_Date")}
      />

      <div className="formgrid--full">
        <TextArea label="Address" required rows={2} {...field("Address")} />
      </div>

      <TextInput
        label="Pin Code"
        required
        inputMode="numeric"
        maxLength={6}
        placeholder="110001"
        {...field("Pin_Code")}
      />

      <TextInput
        label="Ward / Zone"
        placeholder="Optional"
        {...field("Ward_Zone")}
      />
    </Section>
  );
}

/** Contact and collection frequency — section 8.1. */
export function BwgContactSection({ form }) {
  const { list } = useSettings();
  const { field } = form;

  return (
    <Section title="Contact and Collection">
      <TextInput label="Contact Person Name" required {...field("Contact_Person")} />
      <TextInput
        label="Phone Number"
        required
        inputMode="tel"
        placeholder="9810044055"
        {...field("Phone")}
      />
      <TextInput
        label="Email Address"
        required
        type="email"
        placeholder="housekeeping@example.in"
        {...field("Email")}
      />
      <SelectInput
        label="Collection Frequency"
        required
        options={list(SETTING.collectionFrequencies)}
        hint="For information only — it does not restrict inward entry"
        {...field("Collection_Frequency")}
      />
    </Section>
  );
}

/** Tax and agreement — section 8.1. */
export function BwgComplianceSection({ form }) {
  const { list } = useSettings();
  const { field, values, setValue, setMany } = form;

  const gstRegistered = values.GST_Registered === "Yes";
  const panUnavailable = values.PAN_Not_Available === "Yes";

  return (
    <Section title="Tax and Agreement">
      <SelectInput
        label="GST Registered?"
        required
        options={YES_NO}
        {...field("GST_Registered")}
        onChange={(e) => {
          const next = e.target.value;
          setMany({ GST_Registered: next, ...(next === "Yes" ? {} : { GST_Number: "" }) });
        }}
      />

      <TextInput
        label="GST Number"
        required={gstRegistered}
        disabled={!gstRegistered}
        maxLength={15}
        placeholder={gstRegistered ? "07AAACH5678M1Z2" : "Not GST registered"}
        hint={gstRegistered ? "Characters 3–12 must match the PAN" : undefined}
        style={{ textTransform: "uppercase" }}
        {...field("GST_Number")}
        onChange={(e) => setValue("GST_Number", e.target.value.toUpperCase())}
      />

      <div className="field">
        <TextInput
          label="PAN Number"
          required={!panUnavailable}
          disabled={panUnavailable}
          maxLength={10}
          placeholder={panUnavailable ? "Not available" : "AAACH5678M"}
          style={{ textTransform: "uppercase" }}
          {...field("PAN_Number")}
          onChange={(e) => setValue("PAN_Number", e.target.value.toUpperCase())}
        />
        <label className="checkline">
          <input
            type="checkbox"
            checked={panUnavailable}
            onChange={(e) =>
              setMany({
                PAN_Not_Available: e.target.checked ? "Yes" : "No",
                ...(e.target.checked ? { PAN_Number: "" } : {}),
              })
            }
          />
          PAN not available (for example an embassy or RWA)
        </label>
      </div>

      <SelectInput
        label="Type of Agreement"
        required
        options={list(SETTING.agreementTypes)}
        {...field("Agreement_Type")}
      />
    </Section>
  );
}

/** Bank details — required for all three agreement types (section 8.1). */
export function BwgBankSection({ form }) {
  const { field, values } = form;

  return (
    <Section title={`Bank details${values.Agreement_Type ? ` · ${values.Agreement_Type}` : ""}`}>
      <TextInput label="Bank Account Name" required {...field("Bank_Account_Name")} />
      <TextInput label="Bank Name" required {...field("Bank_Name")} />
      <TextInput
        label="Account Number"
        required
        inputMode="numeric"
        autoComplete="off"
        {...field("Account_Number")}
      />
      <TextInput
        label="IFSC Code"
        required
        maxLength={11}
        placeholder="HDFC0000123"
        style={{ textTransform: "uppercase" }}
        {...field("IFSC_Code")}
        onChange={(e) => form.setValue("IFSC_Code", e.target.value.toUpperCase())}
      />
      <TextInput label="Branch Name" required {...field("Branch_Name")} />
      <div className="formgrid--full">
        <TextArea label="Bank Address" required rows={2} {...field("Bank_Address")} />
      </div>
    </Section>
  );
}
