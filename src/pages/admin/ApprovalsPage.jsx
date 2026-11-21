import { useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import Badge from "../../components/common/Badge";
import Button from "../../components/common/Button";
import Card from "../../components/common/Card";
import { TextArea } from "../../components/common/Field";
import Modal from "../../components/common/Modal";
import PageHeader from "../../components/common/PageHeader";
import { Banner, EmptyState, ErrorState, SkeletonRows } from "../../components/common/States";
import { APPROVALS } from "../../config/driveSchema";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useSheetData } from "../../hooks/useSheetData";
import { decideApproval } from "../../services/adminService";
import { dateTime } from "../../utils/format";

const parse = (json) => {
  try {
    return JSON.parse(json || "{}");
  } catch {
    return {};
  }
};

/**
 * Section 3.3 / 17.2 — Supervisor edits awaiting approval, with the old and new
 * values side by side. The original values stay in use until approval.
 */
export default function ApprovalsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { rows, loading, error, reload } = useSheetData(APPROVALS.tab);

  const [deciding, setDeciding] = useState(null);
  const [remark, setRemark] = useState("");
  const [busy, setBusy] = useState(false);

  const pending = useMemo(
    () => rows.filter((r) => !String(r.Decision || "").trim()),
    [rows]
  );
  const decided = useMemo(
    () => rows.filter((r) => String(r.Decision || "").trim()),
    [rows]
  );

  const decide = async (decision) => {
    setBusy(true);
    try {
      await decideApproval({ approval: deciding, decision, remark, user });
      toast.success(
        decision === "Approved" ? "Edit approved" : "Edit rejected",
        `${deciding.Record_Type} ${deciding.Record_Ref_Id}.`
      );
      setDeciding(null);
      setRemark("");
      reload();
    } catch (err) {
      toast.error("Could not record the decision", err.message);
    } finally {
      setBusy(false);
    }
  };

  const renderDiff = (approval) => {
    const oldValues = parse(approval.Old_Values_Json);
    const newValues = parse(approval.New_Values_Json);
    const keys = [...new Set([...Object.keys(oldValues), ...Object.keys(newValues)])];

    if (!keys.length) {
      return <p className="u-muted u-small">No field-level detail was recorded with this edit.</p>;
    }

    return (
      <table className="table difftable">
        <thead>
          <tr>
            <th>Field</th>
            <th>Current value (in use)</th>
            <th>Proposed value</th>
          </tr>
        </thead>
        <tbody>
          {keys.map((key) => {
            const before = oldValues[key];
            const after = newValues[key];
            const changed = String(before ?? "") !== String(after ?? "");
            return (
              <tr key={key} className={changed ? "difftable__changed" : ""}>
                <td>{key.replace(/_/g, " ")}</td>
                <td className="diff-old">{String(before ?? "—")}</td>
                <td className="diff-new">{String(after ?? "—")}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  };

  return (
    <>
      <PageHeader
        title="Approvals"
        description="Edits made by a Supervisor within three days of creating an entry. The original figures stay in use across stock, the dashboard and reports until you approve."
      />

      {pending.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Banner tone="warn">
            <b>{pending.length} edit{pending.length === 1 ? "" : "s"} awaiting approval.</b>{" "}
            Approval is re-checked against stock and certificates at the moment you approve.
          </Banner>
        </div>
      )}

      {loading ? (
        <Card><SkeletonRows rows={4} /></Card>
      ) : error ? (
        <Card><ErrorState error={error} onRetry={reload} /></Card>
      ) : pending.length === 0 ? (
        <Card>
          <EmptyState icon={Check} title="Nothing Awaiting Approval" text="Every Supervisor edit has been decided." />
        </Card>
      ) : (
        pending.map((approval) => (
          <div key={approval.Approval_Id} style={{ marginBottom: 16 }}>
            <Card
              title={`${approval.Record_Type} · ${approval.Record_Ref_Id}`}
              subtitle={`${approval.Change_Type || "Edit"} requested by ${approval.Requested_By || "a Supervisor"} on ${dateTime(approval.Requested_On)}`}
              actions={
                <div className="u-row">
                  <Button
                    size="sm" variant="secondary"
                    onClick={() => { setDeciding({ ...approval, decision: "Rejected" }); setRemark(""); }}
                  >
                    <X size={13} aria-hidden="true" />
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => { setDeciding({ ...approval, decision: "Approved" }); setRemark(""); }}
                  >
                    <Check size={13} aria-hidden="true" />
                    Approve
                  </Button>
                </div>
              }
            >
              {renderDiff(approval)}
            </Card>
          </div>
        ))
      )}

      {decided.length > 0 && (
        <Card title="Decided" subtitle={`${decided.length} past decisions`} flush>
          <div className="tablewrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Record</th>
                  <th>Requested by</th>
                  <th>Decision</th>
                  <th>Remark</th>
                  <th>Decided</th>
                </tr>
              </thead>
              <tbody>
                {decided.map((a) => (
                  <tr key={a.Approval_Id}>
                    <td>{a.Record_Type} · {a.Record_Ref_Id}</td>
                    <td>{a.Requested_By || "—"}</td>
                    <td>
                      <Badge tone={a.Decision === "Approved" ? "ok" : "danger"}>{a.Decision}</Badge>
                    </td>
                    <td className="u-small">{a.Decision_Remark || "—"}</td>
                    <td className="u-small u-muted">{dateTime(a.Decided_On)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        open={Boolean(deciding)}
        title={deciding?.decision === "Approved" ? "Approve This Edit" : "Reject This Edit"}
        subtitle={deciding ? `${deciding.Record_Type} · ${deciding.Record_Ref_Id}` : ""}
        size="sm"
        onClose={() => setDeciding(null)}
      >
        <Banner tone={deciding?.decision === "Approved" ? "info" : "warn"}>
          {deciding?.decision === "Approved"
            ? "The proposed values replace the current ones. The change is refused if it would make stock negative or cut a dispatch below the quantity already certified."
            : "The entry keeps its current values and the Supervisor is told it was rejected."}
        </Banner>

        <div style={{ marginTop: 16 }}>
          <TextArea
            label="Remark" rows={3}
            placeholder="Optional — explain the decision"
            value={remark} onChange={(e) => setRemark(e.target.value)}
          />
        </div>

        <div className="formactions">
          <Button variant="secondary" onClick={() => setDeciding(null)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={deciding?.decision === "Approved" ? "primary" : "danger"}
            onClick={() => decide(deciding.decision)}
            disabled={busy}
          >
            {busy ? "Saving…" : deciding?.decision === "Approved" ? "Approve" : "Reject"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
