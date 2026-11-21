import { useMemo, useState } from "react";
import PageHeader from "../../components/common/PageHeader";
import Tabs from "../../components/common/Tabs";
import { Banner } from "../../components/common/States";
import { useAuth } from "../../context/AuthContext";
import BwgCharacterisationTab from "./BwgCharacterisationTab";
import BwgDailyTab from "./BwgDailyTab";
import MmrfInwardTab from "./MmrfInwardTab";
import RrrInwardTab from "./RrrInwardTab";
import SpecialCollectionTab from "./SpecialCollectionTab";

/**
 * Section 12 — inward entry.
 * Five tabs; a Supervisor sees only the tabs of their assigned source types.
 */
const ALL_TABS = [
  { key: "mmrf", label: "MMRF", source: "MMRF", Component: MmrfInwardTab },
  { key: "rrr", label: "RRR on Wheels", source: "RRR", Component: RrrInwardTab },
  { key: "bwg", label: "BWG daily", source: "BWG", Component: BwgDailyTab },
  { key: "characterisation", label: "BWG characterisation", source: "BWG", Component: BwgCharacterisationTab },
  { key: "special", label: "Special collection", source: "SPECIAL", Component: SpecialCollectionTab },
];

export default function InwardPage() {
  const { canUseSource } = useAuth();

  const tabs = useMemo(() => ALL_TABS.filter((t) => canUseSource(t.source)), [canUseSource]);
  const [activeKey, setActiveKey] = useState(tabs[0]?.key);

  const current = tabs.find((t) => t.key === activeKey) || tabs[0];

  return (
    <>
      <PageHeader
        title="Inward Entry"
        description="Record waste collected from each source. Collection dates can never be in the future."
      />

      {tabs.length === 0 ? (
        <Banner tone="warn">
          You have no source types assigned, so there is nothing to record here.
          Ask a Super Admin to assign your sources.
        </Banner>
      ) : (
        <>
          <Tabs
            tabs={tabs.map((t) => ({ key: t.key, label: t.label }))}
            active={current.key}
            onChange={setActiveKey}
          />
          <current.Component />
        </>
      )}
    </>
  );
}
