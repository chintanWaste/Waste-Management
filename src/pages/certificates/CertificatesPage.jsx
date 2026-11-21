import { useState } from "react";
import PageHeader from "../../components/common/PageHeader";
import Tabs from "../../components/common/Tabs";
import { useSheets } from "../../hooks/useSheets";
import CertificateRegisterTab from "./CertificateRegisterTab";
import DiversionCertificatesTab from "./DiversionCertificatesTab";
import VendorCertificatesTab from "./VendorCertificatesTab";

/** Section 15 — certificates. Super Admin only. */
const TAB_LIST = [
  { key: "vendor", label: "Vendor certificates" },
  { key: "diversion", label: "Diversion certificates" },
  { key: "register", label: "Register" },
];

export default function CertificatesPage() {
  const [activeKey, setActiveKey] = useState("vendor");

  const { data, loading, error, reload } = useSheets([
    "vendors", "bwgs", "dispatch", "dispatchLines",
    "vendorCertificates", "diversionCertificates", "inwardBwg",
  ]);

  const shared = { data, reload, loading, error };

  return (
    <>
      <PageHeader
        title="Certificates"
        description="Track the processing certificates received from vendors, and issue diversion certificates to BWGs from them. MMRF dispatches are not tracked for certificates."
      />

      <Tabs
        tabs={TAB_LIST.map((t) => ({
          key: t.key,
          label: t.label,
          count:
            t.key === "register"
              ? data.diversionCertificates.length || undefined
              : undefined,
        }))}
        active={activeKey}
        onChange={setActiveKey}
      />

      {activeKey === "vendor" && <VendorCertificatesTab {...shared} />}
      {activeKey === "diversion" && <DiversionCertificatesTab {...shared} />}
      {activeKey === "register" && <CertificateRegisterTab {...shared} />}
    </>
  );
}
