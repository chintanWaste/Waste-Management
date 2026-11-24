import { useState } from "react";
import { Info, RefreshCw } from "lucide-react";
import Button from "../../components/common/Button";
import Card from "../../components/common/Card";
import PageHeader from "../../components/common/PageHeader";
import { Banner, ErrorState, SkeletonRows } from "../../components/common/States";
import { useAuth } from "../../context/AuthContext";
import { useSettings } from "../../context/SettingsContext";
import { useToast } from "../../context/ToastContext";
import { rebuildSheetDropdowns, saveList } from "../../services/adminService";
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
      const result = await saveList({
        key,
        values,
        description: catalogue[key]?.description,
        user,
      });

      const label = catalogue[key]?.label || key;
      const written = `${result.count} values written to the Settings tab.`;

      if (result.dropdownError) {
        // The list is saved; only the Sheet's own dropdown is behind.
        toast.warning(
          `${label} saved, Sheet dropdown not updated`,
          `${written} The dropdown in the Sheet still shows the old values — ` +
            `${result.dropdownError}`
        );
      } else if (result.columns) {
        toast.success(
          `${label} saved`,
          `${written} The dropdown on ${result.columns} Sheet column${result.columns === 1 ? "" : "s"} now matches.`
        );
      } else {
        toast.success(`${label} saved`, written);
      }

      reload();
    } catch (err) {
      toast.error("Could not save the list", err.message);
    } finally {
      setSaving("");
    }
  };

  /** Re-apply every list, including the fixed ones, to the Sheet's columns. */
  const rebuild = async () => {
    setSaving("__rebuild");
    try {
      const values = Object.fromEntries(
        Object.keys(catalogue).map((key) => [key, list(key)])
      );
      const columns = await rebuildSheetDropdowns(values);
      toast.success(
        "Sheet dropdowns rebuilt",
        `${columns} column${columns === 1 ? "" : "s"} in the Google Sheet now match the master lists.`
      );
    } catch (err) {
      toast.error("Could not rebuild the Sheet dropdowns", err.message);
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
        description="Every dropdown in the application reads its options from here, and the matching column of the Google Sheet gets the same values as its own dropdown. Add, rename, reorder or remove a value and it changes everywhere immediately."
        actions={
          <Button variant="secondary" onClick={rebuild} disabled={Boolean(saving)}>
            <RefreshCw size={14} aria-hidden="true" />
            {saving === "__rebuild" ? "Rebuilding…" : "Rebuild Sheet dropdowns"}
          </Button>
        }
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
