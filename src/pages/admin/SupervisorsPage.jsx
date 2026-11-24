import { useMemo, useState } from "react";
import { Users as UsersIcon } from "lucide-react";
import Badge from "../../components/common/Badge";
import Card from "../../components/common/Card";
import DataTable from "../../components/common/DataTable";
import { SelectInput, TextInput } from "../../components/common/Field";
import PageHeader from "../../components/common/PageHeader";
import { Banner } from "../../components/common/States";
import { ROLES, SOURCE_TYPE_LABEL } from "../../config/appConfig";
import { useSheets } from "../../hooks/useSheets";
import { date as fmtDate, kg, toInputDate } from "../../utils/format";

/**
 * Which inward tab belongs to which source, and where its quantity lives.
 *
 * The column differs per tab — Waste_Collected_Kg on the MMRF and BWG tabs,
 * Total_Waste_Collected_Kg on RRR and Special, Total_Collected_Kg on
 * characterisation — so each is named here rather than guessed.
 */
const SOURCES = [
  { key: "inwardMmrf", source: "MMRF", qty: "Waste_Collected_Kg", ref: "Entry_Id" },
  { key: "inwardRrr", source: "RRR", qty: "Total_Waste_Collected_Kg", ref: "Entry_Id" },
  { key: "inwardBwg", source: "BWG", qty: "Waste_Collected_Kg", ref: "Entry_Id" },
  { key: "bwgCharacterisation", source: "BWG", qty: "Total_Collected_Kg", ref: "Characterisation_Id" },
  { key: "inwardSpecial", source: "SPECIAL", qty: "Total_Waste_Collected_Kg", ref: "Entry_Code" },
];

const TAB_KEYS = ["users", ...SOURCES.map((s) => s.key)];

/** First day of the current month, as the default "from" date. */
function monthStart() {
  const now = new Date();
  return toInputDate(new Date(now.getFullYear(), now.getMonth(), 1));
}

/**
 * Administration — supervisors and what they have collected.
 *
 * Answers "who recorded waste, from which source, on which date". Every
 * inward tab stores Created_By, so each entry is attributable; this gathers
 * all five tabs into one list and totals them per supervisor.
 */
export default function SupervisorsPage() {
  const { data, loading, error, reload } = useSheets(TAB_KEYS);

  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState("");
  const [who, setWho] = useState("");

  const supervisors = useMemo(
    () => (data.users || []).filter((u) => u.Role === ROLES.SUPERVISOR),
    [data.users]
  );

  /** User id to display name, so a row shows a person rather than "S1". */
  const nameById = useMemo(() => {
    const out = {};
    for (const u of data.users || []) out[String(u.User_Id)] = u.Full_Name || u.Username;
    return out;
  }, [data.users]);

  /** Every inward entry from every tab, flattened to one shape. */
  const entries = useMemo(() => {
    const out = [];
    for (const { key, source, qty, ref } of SOURCES) {
      for (const row of data[key] || []) {
        const by = String(row.Created_By || "").trim();
        out.push({
          Entry_Ref: row[ref] || "",
          Collection_Date: row.Collection_Date || "",
          Source: SOURCE_TYPE_LABEL[source] || source,
          Source_Key: source,
          Area: row.Area || "",
          Quantity_Kg: Number(row[qty] || 0),
          Recorded_By_Id: by,
          Recorded_By: nameById[by] || by || "—",
          Approval_Status: row.Approval_Status || "",
        });
      }
    }
    return out;
  }, [data, nameById]);

  const filtered = useMemo(
    () =>
      entries.filter((e) => {
        if (from && e.Collection_Date && e.Collection_Date < from) return false;
        if (to && e.Collection_Date && e.Collection_Date > to) return false;
        if (who && e.Recorded_By_Id !== who) return false;
        return true;
      }),
    [entries, from, to, who]
  );

  /** Per supervisor: how many entries, how much waste, and when they last did. */
  const totals = useMemo(() => {
    const byUser = new Map();
    for (const e of filtered) {
      const key = e.Recorded_By_Id || "—";
      const acc = byUser.get(key) || { entries: 0, kg: 0, last: "" };
      acc.entries += 1;
      acc.kg += e.Quantity_Kg;
      if (e.Collection_Date > acc.last) acc.last = e.Collection_Date;
      byUser.set(key, acc);
    }
    return byUser;
  }, [filtered]);

  const supervisorRows = useMemo(
    () =>
      supervisors.map((u) => {
        const t = totals.get(String(u.User_Id)) || { entries: 0, kg: 0, last: "" };
        return {
          ...u,
          Entries_Recorded: t.entries,
          Total_Kg: t.kg,
          Last_Collection: t.last,
        };
      }),
    [supervisors, totals]
  );

  const supervisorColumns = [
    { key: "User_Id", header: "ID", render: (u) => <span className="table__code">{u.User_Id}</span> },
    { key: "Full_Name", header: "Supervisor" },
    { key: "Username", header: "Username" },
    {
      key: "Assigned_Source_Types", header: "Assigned Sources",
      render: (u) =>
        u.Assigned_Source_Types
          ? u.Assigned_Source_Types.split("|")
              .filter(Boolean)
              .map((s) => SOURCE_TYPE_LABEL[s] || s)
              .join(", ")
          : <span className="u-muted">None — they can record nothing</span>,
    },
    {
      key: "Assigned_Areas", header: "Areas",
      render: (u) => (u.Assigned_Areas ? u.Assigned_Areas.split("|").filter(Boolean).join(", ") : "All"),
    },
    { key: "Entries_Recorded", header: "Entries", align: "right" },
    { key: "Total_Kg", header: "Waste Recorded", align: "right", render: (u) => kg(u.Total_Kg) },
    {
      key: "Last_Collection", header: "Last Collection",
      render: (u) => (u.Last_Collection ? fmtDate(u.Last_Collection) : <span className="u-muted">Never</span>),
    },
    { key: "Status", header: "Status", render: (u) => <Badge>{u.Status || "Active"}</Badge> },
  ];

  const entryColumns = [
    { key: "Collection_Date", header: "Collection Date", render: (e) => fmtDate(e.Collection_Date) },
    { key: "Recorded_By", header: "Recorded By" },
    { key: "Source", header: "Source" },
    { key: "Area", header: "Area" },
    { key: "Entry_Ref", header: "Entry", render: (e) => <span className="table__code">{e.Entry_Ref}</span> },
    { key: "Quantity_Kg", header: "Quantity", align: "right", render: (e) => kg(e.Quantity_Kg) },
    {
      key: "Approval_Status", header: "Approval",
      render: (e) => (e.Approval_Status ? <Badge>{e.Approval_Status}</Badge> : "—"),
    },
  ];

  return (
    <>
      <PageHeader
        title="Supervisors"
        description="Who recorded waste, from which source, and on which date. Every inward entry stores the user who made it, across all five inward tabs."
      />

      {!loading && supervisors.length === 0 && (
        <div style={{ marginBottom: 16 }}>
          <Banner tone="info" icon={UsersIcon}>
            No Supervisor accounts yet. Add one in <strong>Administration → Users</strong>,
            and assign the source types they may work on — without those they see
            nothing in Inward, Stock or Dispatch.
          </Banner>
        </div>
      )}

      <Card title="Filters">
        <div className="formgrid">
          <TextInput
            label="From Collection Date"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <TextInput
            label="To Collection Date"
            type="date"
            value={to}
            hint="Leave empty for everything up to today"
            onChange={(e) => setTo(e.target.value)}
          />
          <SelectInput
            label="Supervisor"
            value={who}
            placeholder="Everyone"
            options={supervisors.map((u) => ({
              value: String(u.User_Id),
              label: `${u.Full_Name || u.Username} (${u.User_Id})`,
            }))}
            onChange={(e) => setWho(e.target.value)}
          />
        </div>
      </Card>

      <div style={{ marginTop: 20 }}>
        <Card title="Supervisors" subtitle="Totals over the dates filtered above" flush>
          <DataTable
            columns={supervisorColumns}
            rows={supervisorRows}
            loading={loading}
            error={error}
            onRetry={reload}
            exportName="Supervisors"
            emptyText="No supervisors yet"
          />
        </Card>
      </div>

      <div style={{ marginTop: 20 }}>
        <Card
          title="Collection Activity"
          subtitle="One row per inward entry, newest collection dates first"
          flush
        >
          <DataTable
            columns={entryColumns}
            rows={[...filtered].sort((a, b) => String(b.Collection_Date).localeCompare(String(a.Collection_Date)))}
            loading={loading}
            error={error}
            onRetry={reload}
            exportName="Supervisor_Collection_Activity"
            emptyText="No inward entries in this period"
          />
        </Card>
      </div>
    </>
  );
}
