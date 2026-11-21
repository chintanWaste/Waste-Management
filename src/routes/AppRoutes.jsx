import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "../components/layout/AppLayout";
import ApprovalsPage from "../pages/admin/ApprovalsPage";
import AuditLogPage from "../pages/admin/AuditLogPage";
import DeletedItemsPage from "../pages/admin/DeletedItemsPage";
import MasterListsPage from "../pages/admin/MasterListsPage";
import SettingsPage from "../pages/admin/SettingsPage";
import UsersPage from "../pages/admin/UsersPage";
import WasteCategoriesPage from "../pages/admin/WasteCategoriesPage";
import LoginPage from "../pages/auth/LoginPage";
import CertificatesPage from "../pages/certificates/CertificatesPage";
import DashboardPage from "../pages/dashboard/DashboardPage";
import DispatchPage from "../pages/dispatch/DispatchPage";
import InwardPage from "../pages/inward/InwardPage";
import ReportsPage from "../pages/reports/ReportsPage";
import StockPage from "../pages/stock/StockPage";
import LinkagePage from "../pages/linkage/LinkagePage";
import BwgsPage from "../pages/onboarding/BwgsPage";
import FleetPage from "../pages/onboarding/FleetPage";
import MmrfsPage from "../pages/onboarding/MmrfsPage";
import VendorsPage from "../pages/onboarding/VendorsPage";
import ProtectedRoute from "./ProtectedRoute";

/** Built screens only a Super Admin may open (section 3.2). */
const SUPER_ADMIN_PAGES = [
  ["/onboarding/vendors", VendorsPage],
  ["/onboarding/bwgs", BwgsPage],
  ["/onboarding/mmrfs", MmrfsPage],
  ["/onboarding/rrr-on-wheels", FleetPage],
  ["/linkage", LinkagePage],
  ["/admin/waste-categories", WasteCategoriesPage],
  ["/certificates", CertificatesPage],
  ["/admin/users", UsersPage],
  ["/admin/approvals", ApprovalsPage],
  ["/admin/deleted-items", DeletedItemsPage],
  ["/admin/master-lists", MasterListsPage],
  ["/admin/settings", SettingsPage],
  ["/admin/audit-log", AuditLogPage],
];

/** Screens a Supervisor may open too, filtered further by assigned sources. */
const SHARED_PAGES = [
  ["/inward", InwardPage],
  ["/stock", StockPage],
  ["/dispatch", DispatchPage],
  ["/reports", ReportsPage],
];

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />

        {SUPER_ADMIN_PAGES.map(([path, Page]) => (
          <Route
            key={path}
            path={path}
            element={
              <ProtectedRoute superAdminOnly>
                <Page />
              </ProtectedRoute>
            }
          />
        ))}

        {SHARED_PAGES.map(([path, Page]) => (
          <Route key={path} path={path} element={<Page />} />
        ))}
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
