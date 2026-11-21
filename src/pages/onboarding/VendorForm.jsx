import { useEffect, useMemo, useState } from "react";
import Button from "../../components/common/Button";
import FileUpload from "../../components/common/FileUpload";
import { Banner } from "../../components/common/States";
import { SETTING } from "../../config/appConfig";
import { useAuth } from "../../context/AuthContext";
import { useSettings } from "../../context/SettingsContext";
import { useToast } from "../../context/ToastContext";
import { useForm } from "../../hooks/useForm";
import { createVendor, loadVendorIdentifiers, nextVendorCode } from "../../services/vendorService";
import {
  VendorBankSection, VendorComplianceSection,
  VendorContactSection, VendorIdentitySection,
} from "./VendorFormSections";
import { DOCUMENTS_HELP, EMPTY_VENDOR, makeVendorRules } from "./vendorFormRules";

/**
 * Create vendor — specification section 7.1 and 7.2.
 *
 * "Create vendor" stays disabled until every mandatory field is valid and the
 * PDF is chosen. On success the form clears and the directory refreshes.
 */
export default function VendorForm({ onCreated, onCancel }) {
  const { user } = useAuth();
  const { list } = useSettings();
  const toast = useToast();

  const [documents, setDocuments] = useState(null);
  const [identifiers, setIdentifiers] = useState({ pans: [], gstins: [], rows: [] });

  useEffect(() => {
    loadVendorIdentifiers().then(setIdentifiers).catch(() => {});
  }, []);

  const lists = useMemo(
    () => ({
      vendorTypes: list(SETTING.vendorTypes),
      states: list(SETTING.states),
      mouTypes: list(SETTING.mouTypes),
    }),
    [list]
  );

  const rules = useMemo(
    () => makeVendorRules({
      documents,
      existingPans: identifiers.pans,
      existingGstins: identifiers.gstins,
      lists,
    }),
    [documents, identifiers, lists]
  );

  const form = useForm({
    initialValues: EMPTY_VENDOR,
    rules,
    onSubmit: async (values, { reset }) => {
      const code = await createVendor({ values, documents, user });
      reset();
      setDocuments(null);
      toast.success(`Vendor ${code} created`, `${values.Vendor_Name} is now in the directory.`);
      onCreated?.(code);
    },
  });

  const { errorFor, isValid, submitting, submitError, handleSubmit, reset } = form;
  const documentsError = errorFor("Documents");

  const cancel = () => {
    reset();
    setDocuments(null);
    onCancel?.();
  };

  return (
    <>
      <form onSubmit={handleSubmit} noValidate>
        {submitError && (
          <div style={{ marginBottom: 16 }}>
            <Banner tone="danger">{submitError}</Banner>
          </div>
        )}

        <VendorIdentitySection form={form} nextCode={nextVendorCode(identifiers.rows)} />
        <VendorContactSection form={form} />
        <VendorComplianceSection form={form} />
        <VendorBankSection form={form} />

        <div className="formsection">
          <div className="formsection__title">Documents</div>
          <FileUpload
            label="Documents"
            required
            accept="application/pdf"
            maxMb={5}
            helpText={DOCUMENTS_HELP}
            value={documents}
            error={documentsError}
            onChange={setDocuments}
          />
        </div>

        <div className="formactions">
          <Button type="button" variant="secondary" onClick={cancel} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={!isValid || submitting}>
            {submitting ? "Creating…" : "Create vendor"}
          </Button>
        </div>

        {!isValid && (
          <p className="u-small u-muted" style={{ textAlign: "right", marginTop: 8 }}>
            Fill in every required field and attach the PDF to enable this button.
          </p>
        )}
      </form>
    </>
  );
}
