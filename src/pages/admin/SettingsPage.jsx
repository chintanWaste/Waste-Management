import { useMemo, useState } from "react";
import { Download, RotateCw, Save } from "lucide-react";
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
 * The Settings tab is the single source of every threshold and factor the
 * application uses, so editing a value here changes the whole application
 * without a code change.
 *
 * A setting with no row in the tab is not unset: the built-in default in
 * config/defaultLists.json is in force, and that is what the field shows. The
 * screen would otherwise sit there blank while the application ran on values
 * it never mentioned.
 */
const GROUPS = [
  {
    title: "Conversions and Limits",
    keys: ["litreToKgFactor", "maxUploadMb", "maxPhotoMb", "maxPhotosPerEntry"],
  },
  {
    title: "Alert Thresholds",
    note: "In days — these drive the dashboard alerts.",
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
  const { raw, rows, defaults, loading, error, reload } = useSettings();
  const toast = useToast();

  const [edits, setEdits] = useState({});
  const [saving, setSaving] = useState(false);

  const descriptions = useMemo(
    () => Object.fromEntries(rows.map((r) => [r.Setting_Key, r.Description])),
    [rows]
  );

  /** The value the application is using right now, whatever its source. */
  const builtIn = (key) => {
    const value = defaults.numbers?.[key] ?? defaults.text?.[key];
    return value === undefined || value === null ? "" : String(value);
  };
  const effective = (key) => (key in raw ? raw[key] : builtIn(key));

  const valueOf = (key) => (key in edits ? edits[key] : effective(key));
  const changed = Object.keys(edits).filter((key) => edits[key] !== effective(key));

  const allKeys = GROUPS.flatMap((g) => g.keys);
  const onDefault = allKeys.filter((key) => !(key in raw));

  const write = async (patch, done) => {
    setSaving(true);
    try {
      const count = await saveSettings({ changes: patch, user });
      toast.success(
        `${count} setting${count === 1 ? "" : "s"} saved`,
        done || "The change applies across the application straight away."
      );
      setEdits({});
      reload();
    } catch (err) {
      toast.error("Could not save the settings", err.message);
    } finally {
      setSaving(false);
    }
  };

  const save = () =>
    write(Object.fromEntries(changed.map((key) => [key, edits[key]])));

  /**
   * Write the built-in defaults into the tab as real rows. Nothing about how
   * the application behaves changes — the same values were already in force —
   * but they become visible and editable in the Sheet.
   */
  const adopt = () =>
    write(
      Object.fromEntries(onDefault.map((key) => [key, builtIn(key)])),
      "The built-in values are now rows in the Settings tab, and can be edited there or here."
    );

  if (loading) return <><PageHeader title="Settings" /><Card><SkeletonRows rows={8} /></Card></>;
  if (error) return <><PageHeader title="Settings" /><Card><ErrorState error={error} onRetry={reload} /></Card></>;

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

      {onDefault.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Banner tone="info">
            <div className="u-row-between u-wrap" style={{ gap: 12 }}>
              <span>
                <b>
                  {onDefault.length} setting{onDefault.length === 1 ? " is" : "s are"} on
                  the built-in default
                </b>{" "}
                — the values below are the ones in force; they simply have no row in the
                Settings tab yet. Edit any field to save it, or write them all in at once.
              </span>
              <Button size="sm" variant="secondary" onClick={adopt} disabled={saving}>
                <Download size={13} aria-hidden="true" />
                Write defaults to the Sheet
              </Button>
            </div>
          </Banner>
        </div>
      )}

      {GROUPS.map((group) => (
        <div key={group.title} style={{ marginBottom: 16 }}>
          <Card title={group.title} subtitle={group.note}>
            <div className="formgrid">
              {group.keys.map((key) => {
                const present = key in raw;
                const isChanged = changed.includes(key);

                return (
                  <div className="field" key={key}>
                    <label className="field__label">
                      {labelFor(key)}
                      {isChanged && (
                        <span className="badge badge--warn" style={{ marginLeft: 8 }}>Changed</span>
                      )}
                      {!present && !isChanged && (
                        <span className="badge badge--info" style={{ marginLeft: 8 }}>
                          Built-in default
                        </span>
                      )}
                    </label>

                    <input
                      className="input"
                      value={valueOf(key)}
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
