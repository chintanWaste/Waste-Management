import { useMemo, useState } from "react";
import { RotateCw, Save } from "lucide-react";
import Button from "../../components/common/Button";
import Card from "../../components/common/Card";
import PageHeader from "../../components/common/PageHeader";
import { Banner, ErrorState, SkeletonRows } from "../../components/common/States";
import { useAuth } from "../../context/AuthContext";
import { useSettings } from "../../context/SettingsContext";
import { useToast } from "../../context/ToastContext";
import { saveSettings } from "../../services/adminService";

/**
 * Section 17.4 — Settings.
 *
 * The Settings tab is the single source of every dropdown list, threshold and
 * factor the application uses, so editing a value here changes the whole
 * application without a code change. Lists are pipe-separated in one cell;
 * this screen edits them one value per line, which is easier to read.
 */
const GROUPS = [
  {
    title: "Conversions and Limits",
    keys: ["litreToKgFactor", "maxUploadMb", "maxPhotoMb", "maxPhotosPerEntry"],
  },
  {
    title: "Alert Thresholds",
    note: "In days — these drive the dashboard alerts of section 6.4.",
    keys: [
      "certificatePendingDays", "categorisationPendingDays",
      "characterisationPendingDays", "documentExpiryWarnDays", "stockAgeingDays",
    ],
  },
  {
    title: "Supervisor Limits",
    note: "How far back a Supervisor may enter, and how long they may edit.",
    keys: ["supervisorBackdateDays", "supervisorEditWindowDays", "deletedItemsRetentionDays"],
  },
  {
    title: "Certificates and PDFs",
    note: "Printed on diversion certificates and every report.",
    keys: [
      "authorisedSignatoryName", "authorisedSignatoryDesignation",
      "organisationName", "organisationAddress", "diversionCertificatePrefix",
    ],
  },
];

const labelFor = (key) =>
  key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .replace(/\bKg\b/, "kg")
    .replace(/\bMb\b/, "MB")
    .trim();

export default function SettingsPage() {
  const { user } = useAuth();
  const { raw, rows, loading, error, reload } = useSettings();
  const toast = useToast();

  const [edits, setEdits] = useState({});
  const [saving, setSaving] = useState(false);

  const descriptions = useMemo(
    () => Object.fromEntries(rows.map((r) => [r.Setting_Key, r.Description])),
    [rows]
  );

  const valueOf = (key) => (key in edits ? edits[key] : raw[key] ?? "");
  const changed = Object.keys(edits).filter((key) => edits[key] !== (raw[key] ?? ""));

  const save = async () => {
    setSaving(true);
    try {
      const patch = Object.fromEntries(changed.map((key) => [key, edits[key]]));
      const count = await saveSettings({ changes: patch, user });
      toast.success(
        `${count} setting${count === 1 ? "" : "s"} saved`,
        "The change applies across the application straight away."
      );
      setEdits({});
      reload();
    } catch (err) {
      toast.error("Could not save the settings", err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <><PageHeader title="Settings" /><Card><SkeletonRows rows={8} /></Card></>;
  if (error) return <><PageHeader title="Settings" /><Card><ErrorState error={error} onRetry={reload} /></Card></>;

  const missing = GROUPS.flatMap((g) => g.keys).filter((key) => !(key in raw));

  return (
    <>
      <PageHeader
        title="Settings"
        description="Thresholds, conversion factors and the details printed on certificates and reports. Dropdown options live on the Master Lists page."
        actions={
          <>
            <Button variant="secondary" onClick={() => setEdits({})} disabled={!changed.length || saving}>
              <RotateCw size={15} aria-hidden="true" />
              Discard
            </Button>
            <Button onClick={save} disabled={!changed.length || saving}>
              <Save size={15} aria-hidden="true" />
              {saving ? "Saving…" : `Save ${changed.length || ""} change${changed.length === 1 ? "" : "s"}`}
            </Button>
          </>
        }
      />

      {missing.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Banner tone="warn">
            {missing.length} setting{missing.length === 1 ? " is" : "s are"} missing from the
            Settings tab: <code>{missing.join(", ")}</code>. Add the rows, or re-import the
            template, so those screens have their values.
          </Banner>
        </div>
      )}

      {GROUPS.map((group) => (
        <div key={group.title} style={{ marginBottom: 16 }}>
          <Card title={group.title} subtitle={group.note}>
            <div className="formgrid">
              {group.keys.map((key) => {
                const present = key in raw;
                const value = valueOf(key);
                const isChanged = changed.includes(key);

                return (
                  <div className="field" key={key}>
                    <label className="field__label">
                      {labelFor(key)}
                      {isChanged && <span className="badge badge--warn" style={{ marginLeft: 8 }}>changed</span>}
                      {!present && <span className="badge badge--danger" style={{ marginLeft: 8 }}>missing</span>}
                    </label>

                      <input
                        className="input"
                        value={value}
                        onChange={(e) => setEdits((prev) => ({ ...prev, [key]: e.target.value }))}
                      />

                    <span className="field__hint">
                      {descriptions[key] || <code>{key}</code>}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      ))}
    </>
  );
}
