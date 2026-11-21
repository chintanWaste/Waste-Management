import { useMemo, useState } from "react";
import { Ban, ExternalLink } from "lucide-react";
import Badge from "../../components/common/Badge";
import Button from "../../components/common/Button";
import Card from "../../components/common/Card";
import DataTable from "../../components/common/DataTable";
import { TextArea } from "../../components/common/Field";
import Modal from "../../components/common/Modal";
import { Banner } from "../../components/common/States";
import { APP, SETTING } from "../../config/appConfig";
import { useAuth } from "../../context/AuthContext";
import { useSettings } from "../../context/SettingsContext";
import { useToast } from "../../context/ToastContext";
import { viewUrl } from "../../services/drive";
import { cancelDiversionCertificate } from "../../services/certificateService";
import { date, kg } from "../../utils/format";

/**
 * Section 15.3 — the diversion certificate register.
 * Issued certificates cannot be edited; a Super Admin can cancel one with a
 * reason, which returns the quantity to the vendor certificate.
 */
export default function CertificateRegisterTab({ data, reload, loading, error }) {
  const { user, isSuperAdmin } = useAuth();
  const { text } = useSettings();
  const toast = useToast();

  const [cancelling, setCancelling] = useState(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const bwgByCode = useMemo(
    () => Object.fromEntries(data.bwgs.map((b) => [b.BWG_Code, b])),
    [data.bwgs]
  );
  const vendorName = useMemo(
    () => Object.fromEntries(data.vendors.map((v) => [v.Vendor_Code, v.Vendor_Name])),
    [data.vendors]
  );

  const rows = useMemo(
    () =>
      [...data.diversionCertificates].sort((a, b) =>
        String(b.Certificate_Date).localeCompare(String(a.Certificate_Date))
      ),
    [data.diversionCertificates]
  );

  const confirmCancel = async () => {
    setBusy(true);
    try {
      await cancelDiversionCertificate({
        number: cancelling.Diversion_Certificate_No,
        reason,
        bwg: bwgByCode[cancelling.BWG_Code],
        vendorName: vendorName[cancelling.Vendor_Code],
        signatory: {
          name: text(SETTING.authorisedSignatoryName),
          designation: text(SETTING.authorisedSignatoryDesignation),
        },
        logoUrl: APP.logoUrl,
        user,
      });
      toast.success(
        `${cancelling.Diversion_Certificate_No} cancelled`,
        `${kg(cancelling.Quantity_Kg)} returned to certificate ${cancelling.Vendor_Certificate_Number}.`
      );
      setCancelling(null);
      setReason("");
      reload();
    } catch (err) {
      toast.error("Could not cancel the certificate", err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card
        title="Diversion Certificate Register"
        subtitle="Every certificate issued to a BWG. Issued certificates cannot be edited."
        flush
      >
        <DataTable
          rows={rows} loading={loading} error={error} onRetry={reload}
          exportName="Diversion_Certificates"
          exportTitle="Diversion certificate register"
          emptyText="No diversion certificates issued yet"
          columns={[
            {
              key: "Diversion_Certificate_No", header: "Number",
              render: (r) => <span className="table__code">{r.Diversion_Certificate_No}</span>,
            },
            { key: "Certificate_Date", header: "Date", render: (r) => date(r.Certificate_Date) },
            {
              key: "BWG_Code", header: "BWG",
              render: (r) => `${r.BWG_Code} — ${bwgByCode[r.BWG_Code]?.BWG_Name || "Unknown"}`,
            },
            { key: "Material_Group", header: "Material Group" },
            {
              key: "Vendor_Certificate_Number", header: "Vendor Certificate",
              render: (r) => (
                <>
                  {r.Vendor_Certificate_Number}
                  <div className="u-small u-muted">
                    {vendorName[r.Vendor_Code] || r.Vendor_Code}
                  </div>
                </>
              ),
            },
            {
              key: "Quantity_Kg", header: "Quantity", align: "right",
              render: (r) => kg(r.Quantity_Kg),
            },
            {
              key: "Period_From", header: "Period",
              render: (r) => `${date(r.Period_From)} – ${date(r.Period_To)}`,
            },
            {
              key: "Status", header: "Status",
              render: (r) => (
                <Badge tone={String(r.Status).toLowerCase() === "cancelled" ? "muted" : "ok"}>
                  {r.Status || "Active"}
                </Badge>
              ),
            },
            {
              key: "PDF_File_Id", header: "PDF", sortable: false,
              render: (r) =>
                r.PDF_File_Id ? (
                  <a href={viewUrl(r.PDF_File_Id)} target="_blank" rel="noreferrer" className="u-row" style={{ gap: 4 }}>
                    View <ExternalLink size={12} aria-hidden="true" />
                  </a>
                ) : "—",
            },
            {
              key: "actions", header: "", sortable: false,
              render: (r) =>
                String(r.Status || "").toLowerCase() === "cancelled" ? (
                  <span className="u-small u-muted" title={r.Cancelled_Reason}>Cancelled</span>
                ) : isSuperAdmin ? (
                  <button className="btn btn--ghost btn--sm" onClick={() => setCancelling(r)}>
                    <Ban size={13} aria-hidden="true" />
                    Cancel
                  </button>
                ) : "—",
            },
          ]}
        />
      </Card>

      <Modal
        open={Boolean(cancelling)}
        title="Cancel Diversion Certificate"
        subtitle={cancelling?.Diversion_Certificate_No}
        size="sm"
        onClose={() => { setCancelling(null); setReason(""); }}
      >
        <Banner tone="warn">
          The {kg(cancelling?.Quantity_Kg || 0)} goes back to vendor certificate{" "}
          {cancelling?.Vendor_Certificate_Number}, and the PDF is re-stamped "Cancelled".
          This cannot be undone.
        </Banner>

        <div style={{ marginTop: 16 }}>
          <TextArea
            label="Reason for Cancelling" required rows={3}
            placeholder="Why is this certificate being cancelled?"
            value={reason} onChange={(e) => setReason(e.target.value)}
          />
        </div>

        <div className="formactions">
          <Button variant="secondary" onClick={() => { setCancelling(null); setReason(""); }} disabled={busy}>
            Keep it
          </Button>
          <Button variant="danger" onClick={confirmCancel} disabled={!reason.trim() || busy}>
            {busy ? "Cancelling…" : "Cancel certificate"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
