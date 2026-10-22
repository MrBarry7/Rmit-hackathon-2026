"use client";

import { useTideCloak } from "@tidecloak/nextjs";
import { useEffect, useMemo, useState } from "react";
import { QuorumConsole } from "@/components/QuorumConsole";
import { AdminNav } from "@/components/AdminNav";
import { Icon } from "@/components/Icon";
import { liveApi } from "@/lib/quorum/clientApi";

interface Me { name: string; title: string; role: "approver" | "pending" }

// LIVE console with TideCloak login. Every API call goes through secureFetch, which sends the
// DPoP-bound TideCloak token plus a fresh proof signed by this device's key; the server verifies
// both before doing anything. Whether you are an approver is decided by the server, not here.
export default function DashboardPage() {
  const { secureFetch, logout } = useTideCloak();
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const fetcher = useMemo(() => (url: string, init?: RequestInit) => secureFetch(url, init), [secureFetch]);
  const api = useMemo(() => liveApi(fetcher, "live"), [fetcher]);

  useEffect(() => {
    fetcher("/api/whoami")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || `${r.status}`);
        setMe(d.user);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [fetcher]);

  const nav = <AdminNav active="console" consoleHref="/dashboard" databaseHref="/dashboard/database" fetcher={fetcher} onLogout={logout} />;

  if (error) {
    return (
      <div className="center-page">
        <div className="card narrow">
          <div className="eyebrow">Signed in with TideCloak</div>
          <h2>The server could not verify your session</h2>
          <p className="muted small">{error}</p>
          <button className="btn tinted" onClick={logout}><Icon name="logout" size={15} /> Sign out</button>
        </div>
      </div>
    );
  }
  if (me === undefined) return <div className="center-page"><div className="spinner" /><p className="muted">Verifying your TideCloak token…</p></div>;
  if (!me) return null;

  if (me.role !== "approver") {
    return (
      <div className="center-page">
        <div className="card narrow">
          <span className="tile orange"><Icon name="clock" size={18} /></span>
          <div className="eyebrow">Signed in with TideCloak</div>
          <h2>Welcome, {me.name.split(" ")[0]}</h2>
          <p className="muted">
            Your Tide identity is verified, but your account is <b>pending</b>. One approver must request your admission
            and a <b>second, different approver</b> must co-sign it. Until then you can&apos;t see protected data or
            approve anything. Refresh this page once you&apos;re admitted.
          </p>
          <button className="btn tinted" onClick={logout}><Icon name="logout" size={15} /> Sign out</button>
        </div>
      </div>
    );
  }

  return <QuorumConsole api={api} title={me.title} headerRight={nav} />;
}
