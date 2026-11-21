import { LogOut, Menu } from "lucide-react";
import { useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { initials } from "../../utils/format";
import { titleForPath } from "./menuConfig";

export default function Topbar({ onBurger }) {
  const { pathname } = useLocation();
  const { user, signOut } = useAuth();
  const { title, crumb } = titleForPath(pathname);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="topbar">
      <button className="topbar__burger" onClick={onBurger} aria-label="Open menu">
        <Menu size={18} aria-hidden="true" />
      </button>

      <div>
        <div className="topbar__crumb">{crumb}</div>
        <div className="topbar__page">{title}</div>
      </div>

      <div className="u-grow" />

      <div style={{ position: "relative" }}>
        <button
          className="topbar__user"
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <span className="avatar">{initials(user?.name)}</span>
          <span className="u-nowrap" style={{ textAlign: "left" }}>
            <span style={{ display: "block", fontSize: 12.5, fontWeight: 650, color: "var(--c-ink)" }}>
              {user?.name}
            </span>
            <span className="u-small u-muted">{user?.role}</span>
          </span>
        </button>

        {menuOpen && (
          <div
            className="card"
            role="menu"
            style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", minWidth: 200, zIndex: 50, boxShadow: "var(--sh-3)" }}
          >
            <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--c-line)" }}>
              <div style={{ fontWeight: 650, color: "var(--c-ink)" }}>{user?.name}</div>
              <div className="u-small u-muted">@{user?.username}</div>
              {user?.sources?.length > 0 && (
                <div className="u-small u-muted" style={{ marginTop: 6 }}>
                  Sources: {user.sources.join(", ")}
                </div>
              )}
            </div>
            <div style={{ padding: 8 }}>
              <button className="btn btn--ghost btn--sm btn--block" onClick={signOut}>
                <LogOut size={14} aria-hidden="true" />
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
