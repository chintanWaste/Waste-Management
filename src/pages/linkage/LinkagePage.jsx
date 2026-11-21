import { useMemo, useState } from "react";
import { History, Link2 } from "lucide-react";
import Badge from "../../components/common/Badge";
import Button from "../../components/common/Button";
import Card from "../../components/common/Card";
import { SearchBox, SelectInput } from "../../components/common/Field";
import PageHeader from "../../components/common/PageHeader";
import { Banner, EmptyState, ErrorState, SkeletonRows } from "../../components/common/States";
import { SETTING } from "../../config/appConfig";
import { useAuth } from "../../context/AuthContext";
import { useSettings } from "../../context/SettingsContext";
import { useToast } from "../../context/ToastContext";
import { active, useSheets } from "../../hooks/useSheets";
import { assignVendor, currentLinks } from "../../services/linkageService";
import { date, today } from "../../utils/format";
import LinkageHistory from "./LinkageHistory";

/** Section 11 — assign each BWG to the one vendor that collects its waste. */
export default function LinkagePage() {
  const { user } = useAuth();
  const { list } = useSettings();
  const toast = useToast();
  const { data, loading, error, reload } = useSheets(["bwgs", "vendors", "linkage"]);

  const [query, setQuery] = useState("");
  const [areaFilter, setAreaFilter] = useState("");
  const [onlyUnlinked, setOnlyUnlinked] = useState(false);
  const [selected, setSelected] = useState([]);
  const [vendorCode, setVendorCode] = useState("");
  const [fromDate, setFromDate] = useState(today());
  const [saving, setSaving] = useState(false);
  const [historyFor, setHistoryFor] = useState(null);

  const links = useMemo(() => currentLinks(data.linkage), [data.linkage]);
  const vendorName = useMemo(
    () => Object.fromEntries(data.vendors.map((v) => [v.Vendor_Code, v.Vendor_Name])),
    [data.vendors]
  );

  const bwgs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return active(data.bwgs).filter((b) => {
      if (areaFilter && b.Area !== areaFilter) return false;
      if (onlyUnlinked && links[b.BWG_Code]) return false;
      if (q && !`${b.BWG_Code} ${b.BWG_Name}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data.bwgs, areaFilter, onlyUnlinked, query, links]);

  const unlinkedCount = active(data.bwgs).filter((b) => !links[b.BWG_Code]).length;
  const allSelected = bwgs.length > 0 && selected.length === bwgs.length;

  const toggle = (code) =>
    setSelected((list) =>
      list.includes(code) ? list.filter((c) => c !== code) : [...list, code]
    );

  const save = async () => {
    setSaving(true);
    try {
      const { changed, skipped } = await assignVendor({
        bwgCodes: selected, vendorCode, fromDate, user,
      });
      toast.success(
        `${changed} BWG${changed === 1 ? "" : "s"} linked to ${vendorCode}`,
        skipped ? `${skipped} already had this vendor and were left alone.` : undefined
      );
      setSelected([]);
      setVendorCode("");
      reload();
    } catch (err) {
      toast.error("Could not save the linkage", err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="BWG–Vendor Linkage"
        description="Each BWG is collected by exactly one vendor at a time. Allocations are kept by date, so re-linking never changes past figures."
      />

      {unlinkedCount > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Banner tone="warn">
            <b>{unlinkedCount} active BWG{unlinkedCount === 1 ? " is" : "s are"} not linked to a vendor.</b>{" "}
            An unlinked BWG does not appear in daily inward entry.
          </Banner>
        </div>
      )}

      <div className="filterbar">
        <div className="field" style={{ minWidth: 220 }}>
          <label className="field__label">Search</label>
          <SearchBox value={query} onChange={setQuery} placeholder="BWG code or name…" />
        </div>
        <SelectInput
          label="Area" value={areaFilter}
          onChange={(e) => setAreaFilter(e.target.value)}
          options={list(SETTING.areas)} placeholder="All areas"
        />
        <div className="field">
          <label className="field__label">Show</label>
          <label className="checkline" style={{ marginTop: 10 }}>
            <input type="checkbox" checked={onlyUnlinked} onChange={(e) => setOnlyUnlinked(e.target.checked)} />
            Not linked only
          </label>
        </div>
      </div>

      {selected.length > 0 && (
        <Card
          title={`Assign a vendor to ${selected.length} BWG${selected.length === 1 ? "" : "s"}`}
          className="linkbar"
        >
          <div className="formgrid">
            <SelectInput
              label="Vendor" required
              value={vendorCode} onChange={(e) => setVendorCode(e.target.value)}
              options={active(data.vendors).map((v) => ({
                value: v.Vendor_Code, label: `${v.Vendor_Code} — ${v.Vendor_Name}`,
              }))}
              placeholder="Choose a vendor…"
            />
            <div className="field">
              <label className="field__label">Linked from<span className="req">*</span></label>
              <input type="date" className="input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
          </div>
          <div className="formactions">
            <Button variant="secondary" onClick={() => setSelected([])} disabled={saving}>
              Clear selection
            </Button>
            <Button onClick={save} disabled={!vendorCode || !fromDate || saving}>
              <Link2 size={15} aria-hidden="true" />
              {saving ? "Saving…" : "Save linkage"}
            </Button>
          </div>
        </Card>
      )}

      <div style={{ marginTop: selected.length ? 16 : 0 }}>
        <Card title="BWGs" subtitle={`${bwgs.length} shown`} flush>
          {loading ? (
            <SkeletonRows />
          ) : error ? (
            <ErrorState error={error} onRetry={reload} />
          ) : bwgs.length === 0 ? (
            <EmptyState title="No BWGs Match" text="Change the filters, or onboard a BWG first." />
          ) : (
            <div className="tablewrap">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>
                      <input
                        type="checkbox" checked={allSelected}
                        onChange={(e) => setSelected(e.target.checked ? bwgs.map((b) => b.BWG_Code) : [])}
                        aria-label="Select all"
                      />
                    </th>
                    <th>BWG code</th>
                    <th>BWG name</th>
                    <th>Area</th>
                    <th>Current vendor</th>
                    <th>Linked from</th>
                    <th>History</th>
                  </tr>
                </thead>
                <tbody>
                  {bwgs.map((b) => {
                    const link = links[b.BWG_Code];
                    return (
                      <tr key={b.BWG_Code}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selected.includes(b.BWG_Code)}
                            onChange={() => toggle(b.BWG_Code)}
                            aria-label={`Select ${b.BWG_Code}`}
                          />
                        </td>
                        <td><span className="table__code">{b.BWG_Code}</span></td>
                        <td>{b.BWG_Name}</td>
                        <td>{b.Area}</td>
                        <td>
                          {link ? (
                            `${link.Vendor_Code} — ${vendorName[link.Vendor_Code] || "Unknown"}`
                          ) : (
                            <Badge tone="warn">Not linked</Badge>
                          )}
                        </td>
                        <td className="u-nowrap">{link ? date(link.Linked_From_Date) : "—"}</td>
                        <td>
                          <button className="btn btn--ghost btn--sm" onClick={() => setHistoryFor(b)}>
                            <History size={13} aria-hidden="true" />
                            History
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {historyFor && (
        <>
          <div className="scrim scrim--show" onClick={() => setHistoryFor(null)} />
          <LinkageHistory
            bwg={historyFor}
            rows={data.linkage}
            vendorName={vendorName}
            onClose={() => setHistoryFor(null)}
          />
        </>
      )}
    </>
  );
}
