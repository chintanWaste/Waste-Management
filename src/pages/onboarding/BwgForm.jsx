import { useEffect, useMemo, useRef, useState } from "react";
import Button from "../../components/common/Button";
import FileUpload from "../../components/common/FileUpload";
import { Banner } from "../../components/common/States";
import { SETTING } from "../../config/appConfig";
import { BWGS } from "../../config/driveSchema";
import { useAuth } from "../../context/AuthContext";
import { useSettings } from "../../context/SettingsContext";
import { useToast } from "../../context/ToastContext";
import { useForm } from "../../hooks/useForm";
import { createBwg, nextBwgCode, updateBwg } from "../../services/bwgService";
import { viewUrl } from "../../services/drive";
import { readTab } from "../../services/sheetsApi";
import {
  BwgBankSection, BwgComplianceSection,
  BwgContactSection, BwgIdentitySection,
} from "./BwgFormSections";
import {
  DOCUMENTS_HELP, EMPTY_BWG, bwgToForm, duplicateWarning, makeBwgRules,
} from "./bwgFormRules";

/**
 * Create or edit a BWG — specification section 8.1.
 *
 * The submit button stays disabled until every mandatory field is valid and,
 * when creating, the PDF is chosen. A matching name and address raises a
 * warning, not a block (5.2).
 *
 * Passing `bwg` switches the form to editing that row: the fields start
 * filled, the code is fixed, and the PDF becomes optional because one is
 * already on file.
 *
 * `onBusyChange` lets the dialog show its own blocking spinner: uploading the
 * PDF and writing the row take several seconds.
 */
export default function BwgForm({ bwg, onCreated, onCancel, onBusyChange }) {
  const { user } = useAuth();
  const { list, number } = useSettings();
  const toast = useToast();

  const editing = Boolean(bwg);
  const editCode = bwg?.BWG_Code || "";
  const existingDocuments = editing ? viewUrl(bwg.Documents_File_Id) : "";

  const [documents, setDocuments] = useState(null);
  const [existing, setExisting] = useState([]);

  const initialValues = useMemo(
    () => (editing ? bwgToForm(bwg) : EMPTY_BWG),
    [editing, bwg]
  );

  useEffect(() => {
    readTab(BWGS.tab).then(setExisting).catch(() => setExisting([]));
  }, []);

  const lists = useMemo(
    () => ({
      bwgTypes: list(SETTING.bwgTypes),
      areas: list(SETTING.areas),
      operationTypes: list(SETTING.operationTypes),
      collectionFrequencies: list(SETTING.collectionFrequencies),
      agreementTypes: list(SETTING.agreementTypes),
    }),
    [list]
  );

  const rules = useMemo(
    () => makeBwgRules({ documents, lists, requireDocuments: !editing }),
    [documents, lists, editing]
  );

  const form = useForm({
    initialValues,
    rules,
    onSubmit: async (values, { reset }) => {
      const { code, row } = editing
        ? await updateBwg({ code: editCode, values, documents, existing: bwg, user })
        : await createBwg({ values, documents, user });

      reset();
      setDocuments(null);
      toast.success(
        editing ? `BWG ${code} updated` : `BWG ${code} created`,
        editing
          ? `The changes to ${values.BWG_Name} are saved.`
          : `${values.BWG_Name} is now in the directory.`
      );
      onCreated?.({ code, row });
    },
  });

  const { values, errorFor, isValid, submitting, submitError, handleSubmit, reset } = form;
  const warning = editing ? "" : duplicateWarning(values, existing);

  useEffect(() => {
    onBusyChange?.(submitting);
  }, [submitting, onBusyChange]);

  /**
   * A save that fails writes its reason into a banner at the top of a long
   * form, while the button just pressed is at the bottom — without this the
   * form simply appears to do nothing.
   */
  const errorRef = useRef(null);
  useEffect(() => {
    if (!submitError) return;
    errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    toast.error(editing ? "BWG not updated" : "BWG not created", submitError);
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

        {warning && (
          <div style={{ marginBottom: 16 }}>
            <Banner tone="warn">{warning}</Banner>
          </div>
        )}

        <BwgIdentitySection
          form={form}
          nextCode={editing ? editCode : nextBwgCode(existing)}
        />
        <BwgContactSection form={form} />
        <BwgComplianceSection form={form} />
        <BwgBankSection form={form} />

        <div className="formsection">
          <div className="formsection__title">Documents</div>
          <FileUpload
            label="Documents"
            required={!editing}
            accept="application/pdf"
            maxMb={number(SETTING.maxUploadMb, 5)}
            helpText={
              editing && existingDocuments
                ? `A PDF is already on file. Choose one only to replace it. ${DOCUMENTS_HELP}`
                : DOCUMENTS_HELP
            }
            value={documents}
            error={errorFor("Documents")}
            onChange={setDocuments}
            existingUrl={existingDocuments}
            existingLabel={`${editCode} documents PDF`}
          />
        </div>

        <div className="formactions">
          <Button type="button" variant="secondary" onClick={cancel} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={!isValid || submitting}>
            {submitting
              ? (editing ? "Saving…" : "Creating…")
              : (editing ? "Save changes" : "Create BWG")}
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
