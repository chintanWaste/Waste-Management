import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/** Signed-in users only; Super Admin only when `superAdminOnly` is set. */
export default function ProtectedRoute({ superAdminOnly = false, children }) {
  const { user, isSuperAdmin } = useAuth();
  const location = useLocation();

  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (superAdminOnly && !isSuperAdmin) return <Navigate to="/dashboard" replace />;

  return children;
}
