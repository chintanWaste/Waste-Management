import { useEffect, useMemo, useRef, useState } from "react";
import Button from "../../components/common/Button";
import FileUpload from "../../components/common/FileUpload";
import { Banner } from "../../components/common/States";
import { SETTING } from "../../config/appConfig";
import { useAuth } from "../../context/AuthContext";
import { useSettings } from "../../context/SettingsContext";
import { useToast } from "../../context/ToastContext";
import { useForm } from "../../hooks/useForm";
import {
  createVendor, loadVendorIdentifiers, nextVendorCode, updateVendor,
} from "../../services/vendorService";
import {
  VendorBankSection, VendorComplianceSection,
  VendorContactSection, VendorIdentitySection,
} from "./VendorFormSections";
import {
  DOCUMENTS_HELP, EMPTY_VENDOR, makeVendorRules, vendorToForm,
} from "./vendorFormRules";

/**
 * Create or edit a vendor — specification section 7.1 and 7.2.
 *
 * Passing `vendor` switches the form to editing that row: the fields start
 * filled, the code is fixed, and the documents PDF becomes optional because
 * one is already on file. The submit button stays disabled until every
 * mandatory field is valid.
 *
 * `onBusyChange` lets the dialog show its own blocking spinner: uploading the
 * PDF and writing the row can take several seconds, and nothing should be
 * closed or re-submitted in the meantime.
 */
export default function VendorForm({ vendor, onCreated, onCancel, onBusyChange }) {
  const { user } = useAuth();
  const { list } = useSettings();
  const toast = useToast();

  const editing = Boolean(vendor);
  const editCode = vendor?.Vendor_Code || "";

  const [documents, setDocuments] = useState(null);
  const [identifiers, setIdentifiers] = useState({ pans: [], gstins: [], rows: [] });

  useEffect(() => {
    // Editing must not see this vendor's own PAN and GST as a duplicate.
    loadVendorIdentifiers({ exceptCode: editCode }).then(setIdentifiers).catch(() => {});
  }, [editCode]);

  const initialValues = useMemo(
    () => (editing ? vendorToForm(vendor) : EMPTY_VENDOR),
    [editing, vendor]
  );

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
      requireDocuments: !editing,
    }),
    [documents, identifiers, lists, editing]
  );

  const form = useForm({
    initialValues,
    rules,
    onSubmit: async (values, { reset }) => {
      const { code, row } = editing
        ? await updateVendor({ code: editCode, values, documents, existing: vendor, user })
        : await createVendor({ values, documents, user });

      reset();
      setDocuments(null);
      toast.success(
        editing ? `Vendor ${code} updated` : `Vendor ${code} created`,
        editing
          ? `The changes to ${values.Vendor_Name} are saved.`
          : `${values.Vendor_Name} is now in the directory.`
      );
      onCreated?.({ code, row });
    },
  });

  const { errorFor, isValid, submitting, submitError, handleSubmit, reset } = form;
  const documentsError = errorFor("Documents");

  useEffect(() => {
    onBusyChange?.(submitting);
  }, [submitting, onBusyChange]);

  /**
   * A save that fails writes its reason into a banner at the very top of a
   * long form. The button that was just pressed is at the bottom, so without
   * this the form simply appears to do nothing.
   */
  const errorRef = useRef(null);
  useEffect(() => {
    if (!submitError) return;
    errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    toast.error(editing ? "Vendor not updated" : "Vendor not created", submitError);
  }, [submitError, toast, editing]);

  const cancel = () => {
    reset();
    setDocuments(null);
    onCancel?.();
  };

  return (
    <>
      <form onSubmit={handleSubmit} noValidate>
        {submitError && (
          <div ref={errorRef} style={{ marginBottom: 16 }}>
            <Banner tone="danger">{submitError}</Banner>
          </div>
        )}

        <VendorIdentitySection
          form={form}
          nextCode={editing ? editCode : nextVendorCode(identifiers.rows)}
          codeHint={editing ? "The code never changes once a vendor is created" : undefined}
        />
        <VendorContactSection form={form} />
        <VendorComplianceSection form={form} />
        <VendorBankSection form={form} />

        <div className="formsection">
          <div className="formsection__title">Documents</div>
          <FileUpload
            label="Documents"
            required={!editing}
            accept="application/pdf"
            maxMb={5}
            helpText={
              editing
                ? `A PDF is already on file. Choose one only to replace it. ${DOCUMENTS_HELP}`
                : DOCUMENTS_HELP
            }
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
            {submitting
              ? (editing ? "Saving…" : "Creating…")
              : (editing ? "Save changes" : "Create vendor")}
          </Button>
        </div>

        {!isValid && (
          <p className="u-small u-muted" style={{ textAlign: "right", marginTop: 8 }}>
            {editing
              ? "Fill in every required field to enable this button."
              : "Fill in every required field and attach the PDF to enable this button."}
          </p>
        )}
      </form>
    </>
  );
}
