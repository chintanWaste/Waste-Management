import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from "react";
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

  /**
   * Pick up a change a Super Admin has made to this account.
   *
   * Role and assignments are copied into the session at sign-in, so without
   * this a Supervisor whose sources were just assigned would keep seeing "you
   * have no source types assigned" until they happened to sign out and in.
   * Runs once on load; a deactivated or deleted account is signed out.
   */
  useEffect(() => {
    let cancelled = false;
    if (!authService.currentSession()) return undefined;

    authService.refreshSession().then((fresh) => {
      if (!cancelled) setUser(fresh);
    });

    return () => { cancelled = true; };
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
