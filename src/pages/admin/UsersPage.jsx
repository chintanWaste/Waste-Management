import { useState } from "react";
import { KeyRound, Plus, Power, ShieldCheck } from "lucide-react";
import Badge from "../../components/common/Badge";
import Button from "../../components/common/Button";
import Card from "../../components/common/Card";
import DataTable from "../../components/common/DataTable";
import { SelectInput, TextInput } from "../../components/common/Field";
import Modal from "../../components/common/Modal";
import PageHeader from "../../components/common/PageHeader";
import { Banner } from "../../components/common/States";
import { ROLES, SETTING, SOURCE_TYPE_LABEL } from "../../config/appConfig";
import { USERS } from "../../config/driveSchema";
import { useAuth } from "../../context/AuthContext";
import { useSettings } from "../../context/SettingsContext";
import { useToast } from "../../context/ToastContext";
import { useForm } from "../../hooks/useForm";
import { useSheetData } from "../../hooks/useSheetData";
import { createUser, resetUserPassword, setUserStatus } from "../../services/adminService";
import * as r from "../../utils/fieldRules";
import { dateTime } from "../../utils/format";

const EMPTY = {
  Full_Name: "", Username: "", Role: "", Phone: "", Email: "",
  Assigned_Source_Types: [], Assigned_Areas: [],
};

/** A multi-select rendered as tick boxes, which is easier than a native one. */
function CheckGroup({ label, options, value, onChange, hint, required }) {
  const toggle = (option) =>
    onChange(value.includes(option) ? value.filter((v) => v !== option) : [...value, option]);

  return (
    <div className="field">
      <label className="field__label">
        {label}
        {required && <span className="req">*</span>}
      </label>
      <div className="checkgroup">
        {options.map((option) => (
          <label key={option.value ?? option} className="checkline">
            <input
              type="checkbox"
              checked={value.includes(option.value ?? option)}
              onChange={() => toggle(option.value ?? option)}
            />
            {option.label ?? option}
          </label>
        ))}
      </div>
      {hint && <span className="field__hint">{hint}</span>}
    </div>
  );
}

/** Section 17.1 — users. */
export default function UsersPage() {
  const { user } = useAuth();
  const { list } = useSettings();
  const toast = useToast();
  const { rows, loading, error, reload } = useSheetData(USERS.tab);

  const [open, setOpen] = useState(false);
  const [credentials, setCredentials] = useState(null);

  const sourceOptions = list(SETTING.sourceTypes).map((key) => ({
    value: key, label: SOURCE_TYPE_LABEL[key] || key,
  }));

  const form = useForm({
    initialValues: EMPTY,
    rules: {
      Full_Name: r.personName("Full Name"),
      Username: (value) => {
        const text = String(value ?? "").trim();
        if (!text) return "Username is required";
        if (/\s/.test(text)) return "Username cannot contain spaces";
        if (text.length < 3) return "Username must be at least 3 characters";
        if (!/^[a-zA-Z0-9._-]+$/.test(text)) {
          return "Username may use letters, digits and . _ - only";
        }
        return "";
      },
      Role: r.choice("Role", Object.values(ROLES)),
      Assigned_Source_Types: (value, all) =>
        all.Role === ROLES.SUPERVISOR && !value.length
          ? "Assign at least one source type to a Supervisor"
          : "",
      Assigned_Areas: () => "",
      Phone: r.phone("Phone Number", { required: false }),
      Email: r.email("Email Address", { required: false }),
    },
    onSubmit: async (values, { reset }) => {
      const { id, password } = await createUser({ values, user });
      reset();
      setOpen(false);
      setCredentials({ id, username: values.Username, password });
      reload();
    },
  });

  const { field, values, setValue, isValid, submitting, submitError } = form;
  const isSupervisor = values.Role === ROLES.SUPERVISOR;

  const toggleStatus = async (row) => {
    const next = String(row.Status).toLowerCase() === "active" ? "Inactive" : "Active";
    try {
      await setUserStatus({ userId: row.User_Id, status: next });
      toast.success(`${row.Full_Name} is now ${next.toLowerCase()}`);
      reload();
    } catch (err) {
      toast.error("Could not change the status", err.message);
    }
  };

  const resetPassword = async (row) => {
    if (!window.confirm(`Reset the password for ${row.Full_Name}?`)) return;
    try {
      const password = await resetUserPassword({ userId: row.User_Id });
      setCredentials({ id: row.User_Id, username: row.Username, password, reset: true });
      reload();
    } catch (err) {
      toast.error("Could not reset the password", err.message);
    }
  };

  return (
    <>
      <PageHeader
        title="Users"
        description="Super Admins see everything. A Supervisor works only on the source types — and optionally the areas — assigned to them."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus size={15} aria-hidden="true" />
            Create user
          </Button>
        }
      />

      <Card title="User List" flush>
        <DataTable
          rows={rows} loading={loading} error={error} onRetry={reload}
          exportName="Users" emptyText="No users yet"
          columns={[
            { key: "User_Id", header: "ID", render: (u) => <span className="table__code">{u.User_Id}</span> },
            { key: "Full_Name", header: "Full Name" },
            { key: "Username", header: "Username" },
            {
              key: "Role", header: "Role",
              render: (u) => (
                <Badge tone={u.Role === ROLES.SUPER_ADMIN ? "info" : "muted"}>{u.Role}</Badge>
              ),
            },
            {
              key: "Assigned_Source_Types", header: "Assigned Sources",
              render: (u) =>
                u.Role === ROLES.SUPER_ADMIN
                  ? <span className="u-muted">All</span>
                  : (u.Assigned_Source_Types || "—").split("|").join(", "),
            },
            {
              key: "Assigned_Areas", header: "Areas",
              render: (u) => (u.Assigned_Areas ? u.Assigned_Areas.split("|").join(", ") : "All"),
            },
            { key: "Status", header: "Status", render: (u) => <Badge>{u.Status || "Active"}</Badge> },
            {
              key: "Last_Login", header: "Last Login",
              render: (u) => (u.Last_Login ? dateTime(u.Last_Login) : "Never"),
            },
            {
              key: "actions", header: "", sortable: false,
              render: (u) => (
                <div className="u-row" style={{ gap: 4 }}>
                  <button className="btn btn--ghost btn--sm" onClick={() => toggleStatus(u)}>
                    <Power size={13} aria-hidden="true" />
                    {String(u.Status).toLowerCase() === "active" ? "Deactivate" : "Activate"}
                  </button>
                  <button className="btn btn--ghost btn--sm" onClick={() => resetPassword(u)}>
                    <KeyRound size={13} aria-hidden="true" />
                    Reset
                  </button>
                </div>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        open={open}
        title="Create User"
        subtitle="A password is generated and shown once"
        size="md"
        onClose={() => { form.reset(); setOpen(false); }}
      >
        <form onSubmit={form.handleSubmit} noValidate>
          {submitError && (
            <div style={{ marginBottom: 16 }}><Banner tone="danger">{submitError}</Banner></div>
          )}

          <div className="formgrid">
            <TextInput label="Full Name" required {...field("Full_Name")} />
            <TextInput
              label="Username" required hint="No spaces, must be unique"
              {...field("Username")}
            />
            <SelectInput label="Role" required options={Object.values(ROLES)} {...field("Role")} />
            <TextInput label="Phone" hint="Optional" {...field("Phone")} />
            <TextInput label="Email" type="email" hint="Optional" {...field("Email")} />
          </div>

          {isSupervisor && (
            <div className="formsection">
              <div className="formsection__title">What This Supervisor May Work On</div>
              <div className="formgrid">
                <CheckGroup
                  label="Assigned Source Types" required
                  options={sourceOptions}
                  value={values.Assigned_Source_Types}
                  onChange={(next) => setValue("Assigned_Source_Types", next)}
                  hint="Inward entry, stock, dispatch, dashboard and reports are limited to these"
                />
                <CheckGroup
                  label="Assigned Areas"
                  options={list(SETTING.areas)}
                  value={values.Assigned_Areas}
                  onChange={(next) => setValue("Assigned_Areas", next)}
                  hint="Leave all unticked for every area"
                />
              </div>
            </div>
          )}

          <div className="formactions">
            <Button type="button" variant="secondary" onClick={() => { form.reset(); setOpen(false); }}>
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid || submitting}>
              {submitting ? "Creating…" : "Create user"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(credentials)}
        title={credentials?.reset ? "Password Reset" : "User Created"}
        subtitle="This password is shown once — copy it now"
        size="sm"
        onClose={() => setCredentials(null)}
      >
        <Banner tone="warn">
          <ShieldCheck size={0} />
          Write this down or send it to the user securely. It cannot be shown again,
          and they must change it at first login.
        </Banner>

        <div className="credentials">
          <div>
            <span className="u-small u-muted">Username</span>
            <code>{credentials?.username}</code>
          </div>
          <div>
            <span className="u-small u-muted">Password</span>
            <code>{credentials?.password}</code>
          </div>
        </div>

        <div className="formactions">
          <Button
            variant="secondary"
            onClick={() => {
              navigator.clipboard?.writeText(
                `Username: ${credentials.username}\nPassword: ${credentials.password}`
              );
              toast.success("Copied to the clipboard");
            }}
          >
            Copy
          </Button>
          <Button onClick={() => setCredentials(null)}>Done</Button>
        </div>
      </Modal>
    </>
  );
}
