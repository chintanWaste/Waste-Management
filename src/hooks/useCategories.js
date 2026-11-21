import { useMemo } from "react";
import { WASTE_CATEGORIES } from "../config/driveSchema";
import { useSheetData } from "./useSheetData";

/**
 * The waste category master (section 4.2), read live from the Sheet.
 *
 * Screens show categories grouped by stream, then material group, in the order
 * of the master. Deactivated categories are hidden from new entries but stay in
 * history, so `all` keeps them and `categories` does not.
 */
export function useCategories() {
  const { rows, loading, error, reload } = useSheetData(WASTE_CATEGORIES.tab);

  return useMemo(() => {
    const all = rows
      .filter((r) => r.Category_Id)
      .map((r) => ({
        id: r.Category_Id,
        no: Number(r.Serial_No) || 0,
        sort: Number(r.Sort_Order) || Number(r.Serial_No) || 0,
        stream: r.Waste_Stream,
        group: r.Material_Group,
        name: r.Waste_Category,
        unit: r.Unit || "Kg",
        certificate: r.Certificate_Requirement,
        active: String(r.Status || "Active").toLowerCase() === "active",
      }))
      .sort((a, b) => a.sort - b.sort);

    const categories = all.filter((c) => c.active);

    /** [{ stream, groups: [{ group, items: [...] }] }] in master order. */
    const grouped = [];
    for (const c of categories) {
      let stream = grouped.find((s) => s.stream === c.stream);
      if (!stream) { stream = { stream: c.stream, groups: [] }; grouped.push(stream); }
      let group = stream.groups.find((g) => g.group === c.group);
      if (!group) { group = { group: c.group, items: [] }; stream.groups.push(group); }
      group.items.push(c);
    }

    const byId = Object.fromEntries(all.map((c) => [c.id, c]));

    /** Material groups that contain at least one certificate-required category. */
    const certificateGroups = [
      ...new Set(categories.filter((c) => c.certificate === "Required").map((c) => c.group)),
    ];

    return {
      all, categories, grouped, byId, certificateGroups,
      streams: [...new Set(categories.map((c) => c.stream))],
      materialGroups: [...new Set(categories.map((c) => c.group))],
      loading, error, reload,
    };
  }, [rows, loading, error, reload]);
}
