import { useState } from "react";
import { Info } from "lucide-react";
import Card from "../../components/common/Card";
import PageHeader from "../../components/common/PageHeader";
import { Banner, ErrorState, SkeletonRows } from "../../components/common/States";
import { useAuth } from "../../context/AuthContext";
import { useSettings } from "../../context/SettingsContext";
import { useToast } from "../../context/ToastContext";
import { saveList } from "../../services/adminService";
import ListEditor from "./ListEditor";

/**
 * Section 17.4 — the dropdown lists behind every form.
 *
 * Grouped the way someone looks for them: "where do vendor types come from?"
 * rather than by which screen happens to use them.
 */
const GROUPS = [
  {
    title: "Vendors and BWGs",
    keys: ["vendorTypes", "bwgTypes", "mouTypes", "agreementTypes", "collectionFrequencies", "operationTypes"],
  },
  {
    title: "Collection and Dispatch",
    keys: ["dispatchPurposes", "financials", "vehicleTypes", "collectedByOptions", "wasteStreams"],
  },
  {
    title: "Fixed Lists",
    note: "These cannot be changed — the specification fixes them, or the code matches against them.",
    keys: ["areas", "sourceTypes", "roles", "states"],
  },
];

export default function MasterListsPage() {
  const { user } = useAuth();
  const { catalogue, list, listSource, loading, error, reload } = useSettings();
  const toast = useToast();

  const [saving, setSaving] = useState("");

  const save = async (key, values) => {
    setSaving(key);
    try {
      const count = await saveList({
        key,
        values,
        description: catalogue[key]?.description,
        user,
      });
      toast.success(
        `${catalogue[key]?.label || key} saved`,
        `${count} values written to the Settings tab.`
      );
      reload();
    } catch (err) {
      toast.error("Could not save the list", err.message);
    } finally {
      setSaving("");
    }
  };

  if (loading) {
    return (
      <>
        <PageHeader title="Master Lists" />
        <Card><SkeletonRows rows={6} /></Card>
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title="Master Lists" />
        <Card><ErrorState error={error} onRetry={reload} /></Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Master Lists"
        description="Every dropdown in the application reads its options from here. Add, rename, reorder or remove a value and it changes everywhere immediately."
      />

      <div style={{ marginBottom: 16 }}>
        <Banner tone="info" icon={Info}>
          <b>Nothing needs setting up first.</b> Each list starts from a built-in
          default, so the forms work on a brand-new Sheet. The first time you change
          one, it is written into the <code>Settings</code> tab of your Google Sheet
          and that version is used from then on.
        </Banner>
      </div>

      {GROUPS.map((group) => (
        <div key={group.title} style={{ marginBottom: 26 }}>
          <h2 style={{ fontSize: 14, marginBottom: 4 }}>{group.title}</h2>
          {group.note && (
            <p className="u-small u-muted" style={{ margin: "0 0 12px" }}>{group.note}</p>
          )}

          <div className="u-col" style={{ gap: 14 }}>
            {group.keys
              .filter((key) => catalogue[key])
              .map((key) => (
                <ListEditor
                  key={key}
                  listKey={key}
                  meta={catalogue[key]}
                  values={list(key)}
                  source={listSource(key)}
                  onSave={save}
                  saving={saving === key}
                />
              ))}
          </div>
        </div>
      ))}
    </>
  );
}
