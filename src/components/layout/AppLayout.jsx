import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function AppLayout() {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="shell">
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />

      <div
        className={`scrim ${navOpen ? "scrim--show" : ""}`}
        onClick={() => setNavOpen(false)}
        aria-hidden="true"
      />

      <div className="main">
        <Topbar onBurger={() => setNavOpen(true)} />
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
