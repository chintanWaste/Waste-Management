import { useEffect, useMemo, useState } from "react";
import Button from "../../components/common/Button";
import FileUpload from "../../components/common/FileUpload";
import { Banner } from "../../components/common/States";
import { SETTING } from "../../config/appConfig";
import { BWGS } from "../../config/driveSchema";
import { useAuth } from "../../context/AuthContext";
import { useSettings } from "../../context/SettingsContext";
import { useToast } from "../../context/ToastContext";
import { useForm } from "../../hooks/useForm";
import { createBwg, nextBwgCode } from "../../services/bwgService";
import { readTab } from "../../services/sheetsApi";
import {
  BwgBankSection, BwgComplianceSection,
  BwgContactSection, BwgIdentitySection,
} from "./BwgFormSections";
import { DOCUMENTS_HELP, EMPTY_BWG, duplicateWarning, makeBwgRules } from "./bwgFormRules";

/**
 * Create BWG — specification section 8.1.
 *
 * "Create BWG" stays disabled until every mandatory field is valid and the PDF
 * is chosen. A matching name and address raises a warning, not a block (5.2).
 */
export default function BwgForm({ onCreated, onCancel }) {
  const { user } = useAuth();
  const { list, number } = useSettings();
  const toast = useToast();

  const [documents, setDocuments] = useState(null);
  const [existing, setExisting] = useState([]);

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

  const rules = useMemo(() => makeBwgRules({ documents, lists }), [documents, lists]);

  const form = useForm({
    initialValues: EMPTY_BWG,
    rules,
    onSubmit: async (values, { reset }) => {
      const code = await createBwg({ values, documents, user });
      reset();
      setDocuments(null);
      toast.success(`BWG ${code} created`, `${values.BWG_Name} is now in the directory.`);
      onCreated?.(code);
    },
  });

  const { values, errorFor, isValid, submitting, submitError, handleSubmit, reset } = form;
  const warning = duplicateWarning(values, existing);

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

        {warning && (
          <div style={{ marginBottom: 16 }}>
            <Banner tone="warn">{warning}</Banner>
          </div>
        )}

        <BwgIdentitySection form={form} nextCode={nextBwgCode(existing)} />
        <BwgContactSection form={form} />
        <BwgComplianceSection form={form} />
        <BwgBankSection form={form} />

        <div className="formsection">
          <div className="formsection__title">Documents</div>
          <FileUpload
            label="Documents"
            required
            accept="application/pdf"
            maxMb={number(SETTING.maxUploadMb, 5)}
            helpText={DOCUMENTS_HELP}
            value={documents}
            error={errorFor("Documents")}
            onChange={setDocuments}
          />
        </div>

        <div className="formactions">
          <Button type="button" variant="secondary" onClick={cancel} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={!isValid || submitting}>
            {submitting ? "Creating…" : "Create BWG"}
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
