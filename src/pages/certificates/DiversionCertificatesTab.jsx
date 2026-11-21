import { useEffect, useMemo, useState } from "react";
import { Award, Download } from "lucide-react";
import Button from "../../components/common/Button";
import Card from "../../components/common/Card";
import { SelectInput, TextInput } from "../../components/common/Field";
import { Banner, EmptyState } from "../../components/common/States";
import { APP, SETTING } from "../../config/appConfig";
import { useAuth } from "../../context/AuthContext";
import { useSettings } from "../../context/SettingsContext";
import { useToast } from "../../context/ToastContext";
import { useCategories } from "../../hooks/useCategories";
import { active } from "../../hooks/useSheets";
import { issueDiversionCertificate } from "../../services/certificateService";
import {
  eligibleCertificates, nextDiversionNumber,
  overIssuedWarning, suggestedProcessingMethod,
} from "../../utils/certificates";
import { date, kg, today } from "../../utils/format";

const EMPTY = {
  BWG_Code: "", Material_Group: "", Vendor_Certificate_Id: "",
  Quantity_Kg: "", Processing_Method: "",
  Period_From: "", Period_To: "", Certificate_Date: today(),
};

/** Section 15.2 — issue a diversion certificate to a BWG. */
export default function DiversionCertificatesTab({ data, reload }) {
  const { user } = useAuth();
  const { list, text } = useSettings();
  const toast = useToast();
  const { certificateGroups } = useCategories();

  const [values, setValues] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

  const vendorName = useMemo(
    () => Object.fromEntries(data.vendors.map((v) => [v.Vendor_Code, v.Vendor_Name])),
    [data.vendors]
  );

  /** Certificates of the chosen material group with quantity left. */
  const eligible = useMemo(() => {
    if (!values.Material_Group) return [];
    return eligibleCertificates({
      materialGroup: values.Material_Group,
      certificates: data.vendorCertificates,
      diversionCertificates: data.diversionCertificates,
      dispatch: data.dispatch,
    });
  }, [values.Material_Group, data]);

  const source = eligible.find((c) => c.Certificate_Id === values.Vendor_Certificate_Id);

  // Processing method is pre-filled from the purpose of this vendor's BWG dispatches.
  useEffect(() => {
    if (!source) return;
    const suggested = suggestedProcessingMethod({
      vendorCode: source.Vendor_Code, dispatch: data.dispatch,
    });
    if (suggested) setValues((v) => ({ ...v, Processing_Method: suggested }));
  }, [source?.Certificate_Id, data.dispatch]);

  const quantity = Number(values.Quantity_Kg);
  const remaining = source?.remaining ?? 0;
  const overRemaining = quantity > remaining + 0.005;

  const warning = useMemo(() => {
    if (!values.BWG_Code || !values.Period_From || !values.Period_To || !quantity) return "";
    return overIssuedWarning({
      bwgCode: values.BWG_Code,
      periodFrom: values.Period_From,
      periodTo: values.Period_To,
      quantity,
      diversionCertificates: data.diversionCertificates,
      inwardBwg: data.inwardBwg,
    });
  }, [values, quantity, data.diversionCertificates, data.inwardBwg]);

  const periodBackwards =
    values.Period_From && values.Period_To && values.Period_To < values.Period_From;

  const nextNumber = nextDiversionNumber({
    certificateDate: values.Certificate_Date,
    existing: data.diversionCertificates,
    prefix: text(SETTING.diversionCertificatePrefix) || "CHN/DC",
  });

  const ready =
    values.BWG_Code && values.Material_Group && source &&
    quantity > 0 && !overRemaining &&
    values.Processing_Method && values.Period_From && values.Period_To &&
    !periodBackwards && values.Certificate_Date;

  const issue = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const bwg = data.bwgs.find((b) => b.BWG_Code === values.BWG_Code);
      const { number, doc, fileName } = await issueDiversionCertificate({
        values,
        bwg,
        vendorName: vendorName[source.Vendor_Code],
        signatory: {
          name: text(SETTING.authorisedSignatoryName),
          designation: text(SETTING.authorisedSignatoryDesignation),
        },
        logoUrl: APP.logoUrl,
        prefix: text(SETTING.diversionCertificatePrefix) || "CHN/DC",
        user,
      });

      doc.save(fileName); // hand the signed PDF to the user straight away
      toast.success(`Certificate ${number} issued`, `${kg(quantity)} of ${values.Material_Group} to ${values.BWG_Code}.`);
      setValues({ ...EMPTY, Certificate_Date: values.Certificate_Date });
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card
      title="Issue a Diversion Certificate"
      subtitle="One material group per certificate — a BWG needing plastic and paper gets two certificates"
    >
      <form onSubmit={issue} noValidate>
        {error && <div style={{ marginBottom: 16 }}><Banner tone="danger">{error}</Banner></div>}

        <div className="formgrid">
          <TextInput label="Certificate Number" value={nextNumber} disabled hint="Restarts each financial year" />

          <SelectInput
            label="BWG" required value={values.BWG_Code} onChange={set("BWG_Code")}
            options={active(data.bwgs).map((b) => ({
              value: b.BWG_Code, label: `${b.BWG_Code} — ${b.BWG_Name}`,
            }))}
            placeholder="Choose a BWG…"
          />

          <SelectInput
            label="Material Group" required value={values.Material_Group}
            onChange={(e) =>
              setValues((v) => ({ ...v, Material_Group: e.target.value, Vendor_Certificate_Id: "" }))
            }
            options={certificateGroups}
            placeholder="Choose a material group…"
            hint="Only groups that require a certificate"
          />

          <SelectInput
            label="Vendor Certificate Number" required
            value={values.Vendor_Certificate_Id} onChange={set("Vendor_Certificate_Id")}
            options={eligible.map((c) => ({
              value: c.Certificate_Id,
              label: `${c.Certificate_Number} · ${vendorName[c.Vendor_Code] || c.Vendor_Code} · ${date(c.Certificate_Date)} · ${kg(c.remaining)} left`,
            }))}
            placeholder={
              !values.Material_Group
                ? "Choose a material group first"
                : eligible.length
                  ? "Choose a certificate…"
                  : "No certificate with quantity left"
            }
            disabled={!values.Material_Group || eligible.length === 0}
          />

          <TextInput
            label="Remaining Quantity (kg)"
            value={source ? kg(source.remaining) : "—"} disabled
            hint="Certificate quantity minus what has already been issued"
          />

          <TextInput
            label="Quantity (kg)" required inputMode="decimal" placeholder="0.00"
            error={overRemaining ? `Cannot exceed the ${kg(remaining)} remaining` : ""}
            value={values.Quantity_Kg} onChange={set("Quantity_Kg")}
          />

          <SelectInput
            label="Processing Method" required
            value={values.Processing_Method} onChange={set("Processing_Method")}
            options={list(SETTING.dispatchPurposes)}
            hint="Pre-filled from the dispatches to this vendor — editable"
          />

          <TextInput
            label="Period Covered From" required type="date"
            value={values.Period_From} onChange={set("Period_From")}
          />

          <TextInput
            label="Period Covered To" required type="date"
            error={periodBackwards ? "The end date cannot be before the start date" : ""}
            value={values.Period_To} onChange={set("Period_To")}
          />

          <TextInput
            label="Certificate Date" required type="date" max={today()}
            value={values.Certificate_Date} onChange={set("Certificate_Date")}
          />
        </div>

        {values.Material_Group && eligible.length === 0 && (
          <Banner tone="warn">
            No quantity left on any {values.Material_Group} certificate – choose another
            material group, or record a certificate from the vendor first.
          </Banner>
        )}

        {warning && <Banner tone="warn">{warning}</Banner>}

        {!data.bwgs.length && (
          <EmptyState title="No BWGs" text="Onboard a BWG before issuing certificates." />
        )}

        <div className="formactions">
          <span className="u-grow u-small u-muted">
            The PDF downloads straight away and is also saved to Drive.
          </span>
          <Button type="submit" disabled={!ready || saving}>
            {saving ? "Issuing…" : <><Award size={15} aria-hidden="true" />Create diversion certificate</>}
          </Button>
        </div>
      </form>
    </Card>
  );
}
