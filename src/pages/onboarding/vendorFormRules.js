/**
 * Validation rules for the Create vendor form (specification section 7.1).
 *
 * Every field is checked for what it actually holds — a name is not a number,
 * an address is not one word, a PAN matches its format and is not already used.
 */

import * as r from "../../utils/fieldRules";
import { today } from "../../utils/format";

export const EMPTY_VENDOR = {
  Vendor_Name: "",
  Vendor_Type: "",
  Vendor_Type_Other: "",
  Address: "",
  City_District: "",
  State: "",
  Pin_Code: "",
  Contact_Person: "",
  Phone: "",
  Email: "",
  PAN_Number: "",
  GST_Registered: "",
  GST_Number: "",
  Onboarding_Date: today(),
  MoU_Type: "",
  MoU_End_Date: "",
  Bank_Account_Name: "",
  Bank_Name: "",
  Account_Number: "",
  Account_Number_Confirm: "",
  Branch_Name: "",
  IFSC_Code: "",
};

/**
 * `documents` is the chosen File. `lists` carries the dropdown options read
 * from the Settings tab, so a value outside the list is rejected too.
 */
export function makeVendorRules({
  documents, existingPans = [], existingGstins = [], lists = {},
}) {
  const isGst = (all) => all.GST_Registered === "Yes";

  return {
    Vendor_Name: r.orgName("Vendor Name / Firm Name", { max: 150 }),

    Vendor_Type: r.choice("Vendor Type", lists.vendorTypes),

    Vendor_Type_Other: r.when(
      (all) => all.Vendor_Type === "Others",
      r.orgName("The vendor type description", { max: 100 })
    ),

    Address: r.address("Address"),
    City_District: r.placeName("City / District"),
    State: r.choice("State", lists.states),
    Pin_Code: r.pinCode(),

    Contact_Person: r.personName("Contact Person Name"),
    Phone: r.phone(),
    Email: r.email(),

    PAN_Number: (value, all) => {
      const error = r.pan()(value, all);
      if (error) return error;
      if (existingPans.includes(String(value).toUpperCase())) {
        return "This PAN is already used by another vendor";
      }
      return "";
    },

    GST_Registered: r.choice("GST registered", ["Yes", "No"]),

    GST_Number: (value, all) => {
      if (!isGst(all)) return "";
      const error = r.gstin("PAN_Number")(value, all);
      if (error) return error;
      if (existingGstins.includes(String(value).toUpperCase())) {
        return "This GST number is already used by another vendor";
      }
      return "";
    },

    Onboarding_Date: r.pastDate("Date of Onboarding"),

    MoU_Type: r.choice("MoU Type", lists.mouTypes),

    MoU_End_Date: r.when(
      (all) => all.MoU_Type === "Fixed-term",
      r.dateField("MoU End Date", {
        notBefore: "Onboarding_Date",
        notBeforeLabel: "onboarding date",
      })
    ),

    Bank_Account_Name: r.orgName("Bank Account Name", { max: 120 }),
    Bank_Name: r.orgName("Bank Name", { max: 100 }),
    Account_Number: r.accountNumber(),
    Account_Number_Confirm: r.confirmMatch(
      "Account_Number", "Re-entered Account Number", "account number"
    ),
    Branch_Name: r.placeName("Branch Name"),
    IFSC_Code: r.ifsc(),

    Documents: r.requiredFile("The documents PDF", documents),
  };
}

export const DOCUMENTS_HELP =
  "Upload one PDF (max 5 MB) containing: GST certificate (if registered), PAN card, " +
  "cancelled cheque, other registration certificates (e.g. CPCB / DPCC / EPR authorisation), " +
  "and the agreement or MoU with Chintan.";
