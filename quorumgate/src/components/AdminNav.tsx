"use client";

import { Icon } from "./Icon";

// Header links for signed-in admins (local login): Reset demo · Console · Database · Sign out.
export function AdminNav({ active }: { active: "console" | "database" }) {
  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/login";
  };
  const reset = async () => {
    if (!window.confirm("Reset the demo?\n\nThis clears all requests, signatures and the audit log. Admin accounts are kept.")) return;
    const r = await fetch("/api/demo/reset", { method: "POST" }).catch(() => null);
    if (r && r.ok) window.location.reload();
    else window.alert("Could not reset the demo.");
  };
  return (
    <>
      <button className="btn demo-reset small" onClick={reset} title="Demo only: clear requests, signatures and audit log">
        <Icon name="swap" size={13} /> Reset demo
      </button>
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
