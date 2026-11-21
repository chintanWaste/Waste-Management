import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { ROLES } from "../config/appConfig";
import * as authService from "../services/authService";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => authService.currentSession());
  const [busy, setBusy] = useState(false);

  const signIn = useCallback(async (username, password) => {
    setBusy(true);
    try {
      const session = await authService.login(username, password);
      setUser(session);
      return session;
    } finally {
      setBusy(false);
    }
  }, []);

  const signOut = useCallback(() => {
    authService.logout();
    setUser(null);
  }, []);

  const value = useMemo(() => {
    const isSuperAdmin = user?.role === ROLES.SUPER_ADMIN;
    return {
      user,
      busy,
      signIn,
      signOut,
      isSuperAdmin,
      /** Section 3.2 — a Supervisor works only on assigned source types. */
      canUseSource: (sourceKey) =>
        isSuperAdmin || Boolean(user?.sources?.includes(sourceKey)),
      /** Blank assigned areas means all areas. */
      canUseArea: (area) =>
        isSuperAdmin || !user?.areas?.length || user.areas.includes(area),
    };
  }, [user, busy, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
