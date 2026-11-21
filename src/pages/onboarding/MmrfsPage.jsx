import { useState } from "react";
import { ExternalLink, Plus } from "lucide-react";
import Badge from "../../components/common/Badge";
import Button from "../../components/common/Button";
import Card from "../../components/common/Card";
import DataTable from "../../components/common/DataTable";
import FileUpload from "../../components/common/FileUpload";
import { SelectInput, TextArea, TextInput } from "../../components/common/Field";
import Modal from "../../components/common/Modal";
import PageHeader from "../../components/common/PageHeader";
import { Banner } from "../../components/common/States";
import { SETTING } from "../../config/appConfig";
import { MMRFS } from "../../config/driveSchema";
import { useAuth } from "../../context/AuthContext";
import { useSettings } from "../../context/SettingsContext";
import { useToast } from "../../context/ToastContext";
import { useForm } from "../../hooks/useForm";
import { useSheetData } from "../../hooks/useSheetData";
import { viewUrl } from "../../services/drive";
import { createMmrf, nextCode } from "../../services/onboardingService";
import { num } from "../../utils/format";
import * as r from "../../utils/fieldRules";

const EMPTY = {
  MMRF_Name: "", Location: "", Area: "", Operation_Type: "", Complete_Address: "",
  In_Charge_Name: "", Contact_Number: "", Email: "",
  Capacity_Kg_Per_Day: "", Number_Of_Workers: "", Supervised_By: "",
};

/** Section 9 — MMRF / RRR Centre onboarding. All fields mandatory except email. */
export default function MmrfsPage() {
  const { user } = useAuth();
  const { list, number } = useSettings();
  const toast = useToast();
  const { rows, loading, error, reload } = useSheetData(MMRFS.tab);

  const [open, setOpen] = useState(false);
  const [documents, setDocuments] = useState(null);

  const form = useForm({
    initialValues: EMPTY,
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
      MoU: r.requiredFile("The MoU PDF", documents),
    },
    onSubmit: async (values, { reset }) => {
      const code = await createMmrf({ values, documents, user });
      reset();
      setDocuments(null);
      setOpen(false);
      toast.success(`${code} created`, `${values.MMRF_Name} is now in the directory.`);
      reload();
    },
  });

  const { field, errorFor, isValid, submitting, submitError } = form;

  const close = () => {
    form.reset();
    setDocuments(null);
    setOpen(false);
  };

  const columns = [
    { key: "MMRF_Code", header: "Code", render: (r) => <span className="table__code">{r.MMRF_Code}</span> },
    { key: "MMRF_Name", header: "Name" },
    { key: "Area", header: "Area" },
    { key: "Location", header: "Location" },
    { key: "Operation_Type", header: "Operation Type" },
    { key: "In_Charge_Name", header: "In-charge" },
    { key: "Contact_Number", header: "Contact" },
    {
      key: "Capacity_Kg_Per_Day", header: "Capacity", align: "right",
      render: (r) => (r.Capacity_Kg_Per_Day ? `${num(r.Capacity_Kg_Per_Day, 0)} kg/day` : "—"),
    },
    { key: "Number_Of_Workers", header: "Workers", align: "right" },
    { key: "Status", header: "Status", render: (r) => <Badge>{r.Status || "Active"}</Badge> },
    {
      key: "MoU_File_Id", header: "MoU", sortable: false,
      render: (r) =>
        r.MoU_File_Id ? (
          <a href={viewUrl(r.MoU_File_Id)} target="_blank" rel="noreferrer" className="u-row" style={{ gap: 4 }}>
            PDF <ExternalLink size={12} aria-hidden="true" />
          </a>
        ) : "—",
    },
  ];

  return (
    <>
      <PageHeader
        title="MMRF / RRR Centre Onboarding"
        description="The material recovery facilities and RRR Centres Chintan runs across Delhi. Capacity drives the capacity-use graph on the dashboard."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus size={15} aria-hidden="true" />
            Create centre
          </Button>
        }
      />

      <Modal
        open={open}
        title="Create MMRF / RRR Centre"
        subtitle="All fields are required except email"
        onClose={close}
      >
        <form onSubmit={form.handleSubmit} noValidate>
          {submitError && (
            <div style={{ marginBottom: 16 }}><Banner tone="danger">{submitError}</Banner></div>
          )}

          <div className="formsection">
            <div className="formsection__title">Centre Details</div>
            <div className="formgrid">
              <TextInput label="MMRF Code" value={nextCode(rows, "MMRF_Code", "MMRF")} disabled hint="Generated automatically" />
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
              label="MoU with the MMRF In-charge" required
              maxMb={number(SETTING.maxUploadMb, 5)}
              helpText="Upload the signed MoU with the MMRF in-charge as one PDF."
              value={documents} error={errorFor("MoU")} onChange={setDocuments}
            />
          </div>

          <div className="formactions">
            <Button type="button" variant="secondary" onClick={close} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid || submitting}>
              {submitting ? "Creating…" : "Create centre"}
            </Button>
          </div>
        </form>
      </Modal>

      <Card title="MMRF Directory" flush>
        <DataTable
          columns={columns} rows={rows} loading={loading} error={error}
          onRetry={reload} exportName="MMRFs" emptyText="No centres onboarded yet"
        />
      </Card>
    </>
  );
}
