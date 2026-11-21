import { SelectInput, TextArea, TextInput } from "../../components/common/Field";
import PinCodeField from "../../components/common/PinCodeField";
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

/** Identity and address — section 7.1, first block. */
export function VendorIdentitySection({ form, nextCode }) {
  const { list } = useSettings();
  const { field, values, setMany } = form;
  const stateOptions = list(SETTING.states);

  return (
    <Section title="Vendor Details">
      <TextInput
        label="Vendor Code"
        value={nextCode}
        disabled
        hint="Generated automatically and never reused"
      />

      <TextInput
        label="Vendor Name / Firm Name"
        required
        maxLength={150}
        placeholder="e.g. Green Cycle Recyclers Pvt Ltd"
        {...field("Vendor_Name")}
      />

      <SelectInput
        label="Vendor Type"
        required
        options={list(SETTING.vendorTypes)}
        {...field("Vendor_Type")}
      />

      {values.Vendor_Type === "Others" && (
        <TextInput
          label="Please Describe the Vendor Type"
          required
          placeholder="e.g. Refuse-derived fuel processor"
          {...field("Vendor_Type_Other")}
        />
      )}

      <div className="formgrid--full">
        <TextArea label="Address" required rows={2} {...field("Address")} />
      </div>

      

      <SelectInput
        label="State"
        required
        options={stateOptions}
        emptyHint='Add a "states" row to the Settings tab of the Google Sheet'
        {...field("State")}
      />

      <TextInput label="City / District" required {...field("City_District")} />
      {/* Pin code first — typing it fills in the state and district below. */}
      <PinCodeField
        stateOptions={stateOptions}
        value={values.Pin_Code}
        onFill={({ state, district }) =>
          setMany({
            // Never overwrite something already typed.
            ...(state && !values.State ? { State: state } : {}),
            ...(district && !values.City_District ? { City_District: district } : {}),
          })
        }
        {...field("Pin_Code")}
      />
    </Section>
  );
}

/** Contact details — section 7.1. */
export function VendorContactSection({ form }) {
  const { list } = useSettings();
  const { field } = form;

  return (
    <Section title="Contact">
      <TextInput label="Contact Person Name" required {...field("Contact_Person")} />
      <TextInput
        label="Phone Number"
        required
        inputMode="tel"
        placeholder="9811022033"
        {...field("Phone")}
      />
      <TextInput
        label="Email Address"
        required
        type="email"
        placeholder="ops@example.in"
        {...field("Email")}
      />
    </Section>
  );
}

/** Tax, MoU and onboarding date — section 7.1. */
export function VendorComplianceSection({ form }) {
  const { list } = useSettings();
  const { field, values, setMany } = form;
  const gstRegistered = values.GST_Registered === "Yes";

  return (
    <Section title="Tax and Agreement">
      <TextInput
        label="PAN Number"
        required
        maxLength={10}
        placeholder="AABCG1234K"
        style={{ textTransform: "uppercase" }}
        {...field("PAN_Number")}
        onChange={(e) => form.setValue("PAN_Number", e.target.value.toUpperCase())}
      />

      <SelectInput
        label="GST Registered?"
        required
        options={YES_NO}
        placeholder="Select…"
        {...field("GST_Registered")}
        onChange={(e) => {
          // "No" disables and clears the GST number (section 7.1).
          const next = e.target.value;
          setMany({ GST_Registered: next, ...(next === "Yes" ? {} : { GST_Number: "" }) });
        }}
      />

      <TextInput
        label="GST Number"
        required={gstRegistered}
        disabled={!gstRegistered}
        maxLength={15}
        placeholder={gstRegistered ? "07AABCG1234K1Z5" : "Not GST registered"}
        hint={gstRegistered ? "Characters 3–12 must match the PAN above" : undefined}
        style={{ textTransform: "uppercase" }}
        {...field("GST_Number")}
        onChange={(e) => form.setValue("GST_Number", e.target.value.toUpperCase())}
      />

      <TextInput
        label="Date of Onboarding"
        required
        type="date"
        max={new Date().toISOString().slice(0, 10)}
        {...field("Onboarding_Date")}
      />

      <SelectInput label="MoU Type" required options={list(SETTING.mouTypes)} {...field("MoU_Type")} />

      {values.MoU_Type === "Fixed-term" && (
        <TextInput
          label="MoU End Date"
          required
          type="date"
          hint="An alert is raised 30 days before this date"
          {...field("MoU_End_Date")}
        />
      )}
    </Section>
  );
}

/** Bank details — section 7.1; the account number is entered twice. */
export function VendorBankSection({ form }) {
  const { list } = useSettings();
  const { field } = form;

  return (
    <Section title="Bank Details">
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
        label="Re-enter Account Number"
        required
        autoComplete="off"
        onPaste={(e) => e.preventDefault()}
        hint="Type it again — pasting is disabled on purpose"
        {...field("Account_Number_Confirm")}
      />

      <TextInput label="Branch Name" required {...field("Branch_Name")} />
      <TextInput
        label="IFSC Code"
        required
        maxLength={11}
        placeholder="HDFC0000123"
        style={{ textTransform: "uppercase" }}
        {...field("IFSC_Code")}
        onChange={(e) => form.setValue("IFSC_Code", e.target.value.toUpperCase())}
      />
    </Section>
  );
}
