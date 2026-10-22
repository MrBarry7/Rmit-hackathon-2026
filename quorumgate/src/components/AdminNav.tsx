"use client";

import { Icon } from "./Icon";

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

// Header for signed-in admins: Reset demo · Console · Database · Sign out.
// Works for both logins: pass the TideCloak `secureFetch`, links and logout in live mode.
export function AdminNav({
  active,
  consoleHref = "/console",
  databaseHref = "/database",
  fetcher = (url, init) => fetch(url, init),
  onLogout,
}: {
  active: "console" | "database";
  consoleHref?: string;
  databaseHref?: string;
  fetcher?: Fetcher;
  onLogout?: () => void;
}) {
  const logout = async () => {
    if (onLogout) return onLogout();
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/login";
  };
  const reset = async () => {
    if (!window.confirm("Reset the demo?\n\nThis clears all requests, signatures and the audit log. Admin accounts are kept.")) return;
    const r = await fetcher("/api/demo/reset", { method: "POST" }).catch(() => null);
    if (r && r.ok) window.location.reload();
    else window.alert("Could not reset the demo.");
  };
  return (
    <>
      <button className="btn demo-reset small" onClick={reset} title="Demo only: clear requests, signatures and audit log">
        <Icon name="swap" size={13} /> Reset demo
      </button>
      <nav className="tabs" aria-label="Sections">
        <a className={active === "console" ? "on" : ""} href={consoleHref}><Icon name="shield" size={14} /> Console</a>
        <a className={active === "database" ? "on" : ""} href={databaseHref}><Icon name="ticket" size={14} /> Database</a>
      </nav>
      <button className="icon-btn" onClick={logout} title="Sign out" aria-label="Sign out">
        <Icon name="logout" size={16} />
      </button>
    </>
  );
}
