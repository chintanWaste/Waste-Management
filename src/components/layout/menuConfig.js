/**
 * Left-hand menu (section 2 of the specification).
 *
 * `superAdminOnly: true` hides the item from Supervisors entirely — section 3.2
 * requires menus a user may not use to be hidden, not just disabled.
 */

import {
  BadgeCheck, Boxes, Download, FileBarChart,
  LayoutDashboard, Link2, ListChecks, Settings, Truck, UserPlus,
} from "lucide-react";

export const MENU = [
  {
    label: "Overview",
    items: [
      { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
    ],
  },
  {
    label: "Set-up",
    superAdminOnly: true,
    items: [
      {
        key: "onboarding",
        label: "Onboarding",
        icon: UserPlus,
        superAdminOnly: true,
        children: [
          { key: "vendors", label: "Vendors", path: "/onboarding/vendors" },
          { key: "bwgs", label: "BWGs", path: "/onboarding/bwgs" },
          { key: "mmrfs", label: "MMRF / RRR Centres", path: "/onboarding/mmrfs" },
          { key: "fleet", label: "RRR on Wheels", path: "/onboarding/rrr-on-wheels" },
        ],
      },
      {
        key: "linkage",
        label: "BWG–Vendor linkage",
        icon: Link2,
        path: "/linkage",
        superAdminOnly: true,
      },
    ],
  },
  {
    label: "Operations",
    items: [
      { key: "inward", label: "Inward entry", icon: Download, path: "/inward" },
      { key: "stock", label: "Stock", icon: Boxes, path: "/stock" },
      { key: "dispatch", label: "Dispatch", icon: Truck, path: "/dispatch" },
      {
        key: "certificates",
        label: "Certificates",
        icon: BadgeCheck,
        path: "/certificates",
        superAdminOnly: true,
      },
    ],
  },
  {
    label: "Output",
    items: [
      { key: "reports", label: "Reports", icon: FileBarChart, path: "/reports" },
      {
        key: "admin",
        label: "Administration",
        icon: Settings,
        superAdminOnly: true,
        children: [
          { key: "users", label: "Users", path: "/admin/users" },
          { key: "approvals", label: "Approvals", path: "/admin/approvals" },
          { key: "deleted", label: "Deleted items", path: "/admin/deleted-items" },
          { key: "categories", label: "Waste categories", path: "/admin/waste-categories" },
          { key: "lists", label: "Master lists", path: "/admin/master-lists" },
          { key: "settings", label: "Settings", path: "/admin/settings" },
          { key: "audit", label: "Audit log", path: "/admin/audit-log" },
        ],
      },
    ],
  },
];

/** Keep only what this role may see. */
export function visibleMenu(isSuperAdmin) {
  if (isSuperAdmin) return MENU;
  return MENU.filter((group) => !group.superAdminOnly)
    .map((group) => ({
      ...group,
      items: group.items
        .filter((item) => !item.superAdminOnly)
        .map((item) => ({
          ...item,
          children: item.children?.filter((c) => !c.superAdminOnly),
        })),
    }))
    .filter((group) => group.items.length > 0);
}

/** Page title shown in the top bar, by path. */
export function titleForPath(pathname) {
  for (const group of MENU) {
    for (const item of group.items) {
      if (item.path === pathname) return { title: item.label, crumb: group.label };
      const child = item.children?.find((c) => c.path === pathname);
      if (child) return { title: child.label, crumb: item.label };
    }
  }
  return { title: "Dashboard", crumb: "Overview" };
}
