import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { APP } from "../../config/appConfig";
import { useAuth } from "../../context/AuthContext";
import { visibleMenu } from "./menuConfig";

function NavGroupItem({ item, onNavigate }) {
  const { pathname } = useLocation();
  const Icon = item.icon;
  const hasChildren = Boolean(item.children?.length);
  const childActive = item.children?.some((c) => c.path === pathname);
  const [open, setOpen] = useState(Boolean(childActive));

  if (!hasChildren) {
    return (
      <NavLink
        to={item.path}
        onClick={onNavigate}
        className={({ isActive }) => `navitem ${isActive ? "navitem--active" : ""}`}
      >
        <Icon className="navitem__icon" size={17} strokeWidth={1.9} aria-hidden="true" />
        {item.label}
      </NavLink>
    );
  }

  return (
    <>
      <button
        type="button"
        className={`navitem ${childActive ? "navitem--active" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <Icon className="navitem__icon" size={17} strokeWidth={1.9} aria-hidden="true" />
        {item.label}
        {open
          ? <ChevronDown className="navitem__chev" size={14} aria-hidden="true" />
          : <ChevronRight className="navitem__chev" size={14} aria-hidden="true" />}
      </button>

      {open && (
        <div className="navsub">
          {item.children.map((child) => (
            <NavLink
              key={child.key}
              to={child.path}
              onClick={onNavigate}
              className={({ isActive }) => `navitem ${isActive ? "navitem--active" : ""}`}
            >
              {child.label}
            </NavLink>
          ))}
        </div>
      )}
    </>
  );
}

export default function Sidebar({ open, onClose }) {
  const { isSuperAdmin } = useAuth();
  const groups = visibleMenu(isSuperAdmin);

  return (
    <aside className={`sidebar ${open ? "sidebar--open" : ""}`}>
      <div className="sidebar__brand">
        <img className="sidebar__logo" src={APP.logoUrl} alt="Chintan logo" />
        <div>
          <div className="sidebar__title">Waste Operations</div>
          <div className="sidebar__sub">Tracking System</div>
        </div>
      </div>

      <nav className="sidebar__nav">
        {groups.map((group) => (
          <div key={group.label}>
            <div className="navgroup__label">{group.label}</div>
            {group.items.map((item) => (
              <NavGroupItem key={item.key} item={item} onNavigate={onClose} />
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
