"use client";

import { Icon } from "./Icon";

// Header links for signed-in admins (local login): Console · Database · Sign out.
export function AdminNav({ active }: { active: "console" | "database" }) {
  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/login";
  };
  return (
    <>
      <nav className="tabs" aria-label="Sections">
        <a className={active === "console" ? "on" : ""} href="/console"><Icon name="shield" size={14} /> Console</a>
        <a className={active === "database" ? "on" : ""} href="/database"><Icon name="ticket" size={14} /> Database</a>
      </nav>
      <button className="icon-btn" onClick={logout} title="Sign out" aria-label="Sign out">
        <Icon name="logout" size={16} />
      </button>
    </>
  );
}
