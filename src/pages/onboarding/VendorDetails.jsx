import { ExternalLink } from "lucide-react";
import Badge from "../../components/common/Badge";
import { viewUrl } from "../../services/drive";
import { date, dateTime } from "../../utils/format";

/** One label-and-value pair. Blank values show an em dash rather than nothing. */
function Detail({ label, children }) {
  const empty = children === null || children === undefined || children === "";
  return (
    <div>
      <div className="u-small u-muted">{label}</div>
      <div style={{ marginTop: 2 }}>{empty ? "—" : children}</div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="formsection">
      <div className="formsection__title">{title}</div>
      <div className="formgrid">{children}</div>
    </div>
  );
}

/**
 * Read-only view of one vendor, for the directory's View action.
 *
 * Shows everything stored, including the audit columns, which the form does
 * not display because they are not editable.
 */
export default function VendorDetails({ vendor }) {
  if (!vendor) return null;

  const documents = vendor.Documents_File_Id;

  return (
    <>
      <Section title="Vendor Details">
        <Detail label="Vendor Code">
          <span className="table__code">{vendor.Vendor_Code}</span>
        </Detail>
        <Detail label="Vendor Name / Firm Name">{vendor.Vendor_Name}</Detail>
        <Detail label="Vendor Type">
          {vendor.Vendor_Type === "Others" && vendor.Vendor_Type_Other
            ? `Others — ${vendor.Vendor_Type_Other}`
            : vendor.Vendor_Type}
        </Detail>
        <Detail label="Status">
          <Badge>{vendor.Status || "Active"}</Badge>
        </Detail>
        <Detail label="Address">{vendor.Address}</Detail>
        <Detail label="City / District">{vendor.City_District}</Detail>
        <Detail label="State">{vendor.State}</Detail>
        <Detail label="Pin Code">{vendor.Pin_Code}</Detail>
      </Section>

      <Section title="Contact">
        <Detail label="Contact Person">{vendor.Contact_Person}</Detail>
        <Detail label="Phone">{vendor.Phone}</Detail>
        <Detail label="Email">{vendor.Email}</Detail>
      </Section>

      <Section title="Tax and Agreement">
        <Detail label="PAN Number">{vendor.PAN_Number}</Detail>
        <Detail label="GST Registered">{vendor.GST_Registered}</Detail>
        <Detail label="GST Number">{vendor.GST_Number}</Detail>
        <Detail label="Date of Onboarding">{date(vendor.Onboarding_Date)}</Detail>
        <Detail label="MoU Type">{vendor.MoU_Type}</Detail>
        <Detail label="MoU End Date">
          {vendor.MoU_End_Date ? date(vendor.MoU_End_Date) : ""}
        </Detail>
      </Section>

      <Section title="Bank Details">
        <Detail label="Bank Account Name">{vendor.Bank_Account_Name}</Detail>
        <Detail label="Bank Name">{vendor.Bank_Name}</Detail>
        <Detail label="Account Number">{vendor.Account_Number}</Detail>
        <Detail label="Branch Name">{vendor.Branch_Name}</Detail>
        <Detail label="IFSC Code">{vendor.IFSC_Code}</Detail>
      </Section>

      <Section title="Documents">
        <Detail label="Documents PDF">
          {documents ? (
            <a
              href={viewUrl(documents)}
              target="_blank"
              rel="noreferrer"
              className="u-row"
              style={{ gap: 4 }}
            >
              Open the PDF <ExternalLink size={12} aria-hidden="true" />
            </a>
          ) : ""}
        </Detail>
      </Section>

      <Section title="Record">
        <Detail label="Created By">{vendor.Created_By}</Detail>
        <Detail label="Created On">
          {vendor.Created_On ? dateTime(vendor.Created_On) : ""}
        </Detail>
        <Detail label="Updated By">{vendor.Updated_By}</Detail>
        <Detail label="Updated On">
          {vendor.Updated_On ? dateTime(vendor.Updated_On) : ""}
        </Detail>
      </Section>
    </>
  );
}
