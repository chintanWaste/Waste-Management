/**
 * Validation rules for the BWG onboarding form (specification section 8.1).
 *
 * Differences from the vendor form worth noting:
 *  - Ward / Zone is the only optional field.
 *  - PAN is mandatory unless "PAN not available" is ticked (embassies, RWAs).
 *  - Bank details are required for all three agreement types.
 *  - A duplicate name and address is a warning, not a block (section 5.2).
 */

import * as r from "../../utils/fieldRules";
import { today } from "../../utils/format";

export const EMPTY_BWG = {
  BWG_Name: "",
  BWG_Type: "",
  BWG_Type_Other: "",
  Area: "",
  Operation_Type: "",
  Onboarding_Date: today(),
  Address: "",
  Pin_Code: "",
  Ward_Zone: "",
  Contact_Person: "",
  Phone: "",
  Email: "",
  Collection_Frequency: "",
  GST_Registered: "",
  GST_Number: "",
  PAN_Number: "",
  PAN_Not_Available: "No",
  Agreement_Type: "",
  Bank_Account_Name: "",
  Bank_Name: "",
  Account_Number: "",
  IFSC_Code: "",
  Branch_Name: "",
  Bank_Address: "",
};

export function makeBwgRules({ documents, lists = {} }) {
  const hasPan = (all) => all.PAN_Not_Available !== "Yes";
  const isGst = (all) => all.GST_Registered === "Yes";

  return {
    BWG_Name: r.orgName("BWG Name", { max: 150 }),

    BWG_Type: r.choice("BWG Type", lists.bwgTypes),

    BWG_Type_Other: r.when(
      (all) => all.BWG_Type === "Others",
      r.orgName("The BWG type description", { max: 100 })
    ),

    Area: r.choice("Area", lists.areas),
    Operation_Type: r.choice("Operation Type", lists.operationTypes),

    Onboarding_Date: r.pastDate("Onboarding Date"),

    Address: r.address("Address"),
    Pin_Code: r.pinCode(),

    // The one optional field (section 8.1) — still checked if something is typed.
    Ward_Zone: r.placeName("Ward / Zone", { required: false, max: 60 }),

    Contact_Person: r.personName("Contact Person Name"),
    Phone: r.phone(),
    Email: r.email(),

    Collection_Frequency: r.choice("Collection Frequency", lists.collectionFrequencies),

    GST_Registered: r.choice("GST registered", ["Yes", "No"]),
    GST_Number: r.when(isGst, r.gstin("PAN_Number")),

    PAN_Number: r.when(hasPan, r.pan()),
    PAN_Not_Available: r.choice("PAN availability", ["Yes", "No"]),

    Agreement_Type: r.choice("Type of Agreement", lists.agreementTypes),

    // Required for all agreement types (section 8.1).
    Bank_Account_Name: r.orgName("Bank Account Name", { max: 120 }),
    Bank_Name: r.orgName("Bank Name", { max: 100 }),
    Account_Number: r.accountNumber(),
    IFSC_Code: r.ifsc(),
    Branch_Name: r.placeName("Branch Name"),
    Bank_Address: r.address("Bank Address", { min: 6 }),

    Documents: r.requiredFile("The documents PDF", documents),
  };
}

/**
 * Section 5.2 — a BWG with the same name and address is a warning the user can
 * accept, not an error that blocks the form.
 */
export function duplicateWarning(values, existing = []) {
  const name = values.BWG_Name.trim().toLowerCase();
  const address = values.Address.trim().toLowerCase();
  if (!name || !address) return "";

  const match = existing.find(
    (row) =>
      String(row.BWG_Name || "").trim().toLowerCase() === name &&
      String(row.Address || "").trim().toLowerCase() === address
  );

  return match
    ? `${match.BWG_Code} already has this name and address. Create this one only if it is genuinely a separate generator.`
    : "";
}

export const DOCUMENTS_HELP =
  "Upload one PDF (max 5 MB) containing: agreement / MoU between the BWG and Chintan; " +
  "GST certificate (if GST-registered); PAN card (if available); cancelled cheque; and any " +
  "other relevant document such as an authorisation letter or work order.";
