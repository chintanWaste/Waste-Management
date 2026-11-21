import { useMemo, useState } from "react";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import Badge from "../../components/common/Badge";
import Button from "../../components/common/Button";
import Card from "../../components/common/Card";
import DataTable from "../../components/common/DataTable";
import { SelectInput } from "../../components/common/Field";
import { Banner, EmptyState } from "../../components/common/States";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useCategories } from "../../hooks/useCategories";
import { active } from "../../hooks/useSheets";
import { viewUrl } from "../../services/drive";
import { deleteVendorCertificate } from "../../services/certificateService";
import {
  certificateRows, certificatesWithRemaining, vendorDispatched,
} from "../../utils/certificates";
import { date, kg } from "../../utils/format";
import AddCertificateModal from "./AddCertificateModal";

/** Section 15.1 — vendor certificate tracking. */
export default function VendorCertificatesTab({ data, reload, loading, error }) {
  const { user } = useAuth();
  const toast = useToast();
  const { certificateGroups } = useCategories();

  const [vendorCode, setVendorCode] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [adding, setAdding] = useState(null);

  const vendorName = useMemo(
    () => Object.fromEntries(data.vendors.map((v) => [v.Vendor_Code, v.Vendor_Name])),
    [data.vendors]
  );

  const totals = useMemo(() => {
    if (!vendorCode) return null;
    return vendorDispatched({
      vendorCode, dispatch: data.dispatch, dispatchLines: data.dispatchLines, from, to,
    });
  }, [vendorCode, data.dispatch, data.dispatchLines, from, to]);

  const rows = useMemo(() => {
    if (!vendorCode) return [];
    return certificateRows({
      vendorCode,
      dispatch: data.dispatch,
      dispatchLines: data.dispatchLines,
      certificates: data.vendorCertificates,
      certificateGroups,
      from, to,
    });
  }, [vendorCode, data, certificateGroups, from, to]);

  const received = useMemo(() => {
    const all = certificatesWithRemaining(data.vendorCertificates, data.diversionCertificates);
    return vendorCode ? all.filter((c) => c.Vendor_Code === vendorCode) : all;
  }, [data.vendorCertificates, data.diversionCertificates, vendorCode]);

  const remove = async (certificate) => {
    if (!window.confirm(`Delete certificate ${certificate.Certificate_Number}?`)) return;
    try {
      await deleteVendorCertificate({ certificateId: certificate.Certificate_Id, user });
      toast.success(`Certificate ${certificate.Certificate_Number} deleted`);
      reload();
    } catch (err) {
      toast.error("Could not delete the certificate", err.message);
    }
  };

  return (
    <>
      <div className="filterbar">
        <SelectInput
          label="Vendor" value={vendorCode}
          onChange={(e) => setVendorCode(e.target.value)}
          options={active(data.vendors).map((v) => ({
            value: v.Vendor_Code, label: `${v.Vendor_Code} — ${v.Vendor_Name}`,
          }))}
          placeholder="Choose a vendor…"
        />
        <div className="field">
          <label className="field__label">From</label>
          <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="field">
          <label className="field__label">To</label>
          <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="u-grow" />
        <button className="btn btn--secondary" onClick={() => { setFrom(""); setTo(""); }}>
          All time
        </button>
      </div>

      {!vendorCode ? (
        <Card>
          <EmptyState
            title="Choose a Vendor"
            text="Pick a vendor to see what has been dispatched to them and what they have certified."
          />
        </Card>
      ) : (
        <>
          <div className="stats" style={{ marginBottom: 16 }}>
            <div className="stat stat--info">
              <div className="stat__label">Dispatched for certification</div>
              <div className="stat__value">{kg(totals.trackedTotal, 0)}</div>
              <div className="stat__split">
                <span>RRR on Wheels, BWG and Special collection only</span>
              </div>
            </div>
            <div className="stat">
              <div className="stat__label">MMRF dispatches</div>
              <div className="stat__value">{kg(totals.mmrfTotal, 0)}</div>
              <div className="stat__split"><span>Not tracked for certificates</span></div>
            </div>
            {Object.entries(totals.byStream).map(([stream, value]) => (
              <div className="stat" key={stream}>
                <div className="stat__label">{stream}</div>
                <div className="stat__value">{kg(value, 0)}</div>
              </div>
            ))}
          </div>

          <Card
            title="Certification by Material Group"
            subtitle="Only material groups that contain certificate-required categories, counting only those categories"
            flush
          >
            {rows.length === 0 ? (
              <EmptyState
                title="Nothing to Certify"
                text="No certificate-required waste has been dispatched to this vendor in this period."
              />
            ) : (
              <div className="tablewrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Material group</th>
                      <th>Certificate</th>
                      <th className="u-right">Dispatched (kg)</th>
                      <th className="u-right">Certified (kg)</th>
                      <th className="u-right">Pending (kg)</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.group}>
                        <td><b>{row.group}</b></td>
                        <td><Badge tone="info">Required</Badge></td>
                        <td className="u-right u-mono">{kg(row.dispatched)}</td>
                        <td className="u-right u-mono">{kg(row.certified)}</td>
                        <td className={`u-right u-mono ${row.pending > 0 ? "u-pending" : "u-done"}`}>
                          <b>{kg(row.pending)}</b>
                        </td>
                        <td>
                          {row.pending > 0 ? (
                            <Button size="sm" variant="secondary" onClick={() => setAdding(row)}>
                              <Plus size={13} aria-hidden="true" />
                              Add certificate
                            </Button>
                          ) : (
                            <span className="u-small u-done">Fully certified</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      <div style={{ marginTop: 16 }}>
        <Card
          title="Certificates Received"
          subtitle={vendorCode ? `From ${vendorCode}` : "From all vendors"}
          flush
        >
          <DataTable
            rows={received} loading={loading} error={error} onRetry={reload}
            exportName="Vendor_Certificates" emptyText="No certificates recorded yet"
            columns={[
              {
                key: "Certificate_Number", header: "Certificate No.",
                render: (r) => <span className="table__code">{r.Certificate_Number}</span>,
              },
              { key: "Certificate_Date", header: "Date", render: (r) => date(r.Certificate_Date) },
              {
                key: "Vendor_Code", header: "Vendor",
                render: (r) => `${r.Vendor_Code} — ${vendorName[r.Vendor_Code] || "Unknown"}`,
              },
              { key: "Material_Group", header: "Material Group" },
              { key: "total", header: "Quantity", align: "right", render: (r) => kg(r.total) },
              { key: "used", header: "Used", align: "right", render: (r) => kg(r.used) },
              {
                key: "remaining", header: "Remaining", align: "right",
                render: (r) => (
                  <b className={r.remaining > 0 ? "" : "u-muted"}>{kg(r.remaining)}</b>
                ),
              },
              {
                key: "Certificate_File_Id", header: "PDF", sortable: false,
                render: (r) =>
                  r.Certificate_File_Id ? (
                    <a href={viewUrl(r.Certificate_File_Id)} target="_blank" rel="noreferrer" className="u-row" style={{ gap: 4 }}>
                      View <ExternalLink size={12} aria-hidden="true" />
                    </a>
                  ) : "—",
              },
              {
                key: "actions", header: "", sortable: false,
                render: (r) =>
                  r.used > 0 ? (
                    <span className="u-small u-muted" title="Used by a diversion certificate">Locked</span>
                  ) : (
                    <button className="btn btn--ghost btn--sm" onClick={() => remove(r)}>
                      <Trash2 size={13} aria-hidden="true" />
                    </button>
                  ),
              },
            ]}
          />
        </Card>
      </div>

      <AddCertificateModal
        open={Boolean(adding)}
        row={adding}
        vendorCode={vendorCode}
        vendorName={vendorName[vendorCode]}
        certificateGroups={certificateGroups}
        onClose={() => setAdding(null)}
        onSaved={() => { setAdding(null); reload(); }}
      />
    </>
  );
}
