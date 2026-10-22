"use client";

import { useEffect, useMemo, useState } from "react";
import { QuorumConsole } from "@/components/QuorumConsole";
import { AdminNav } from "@/components/AdminNav";
import { Icon } from "@/components/Icon";
import { liveApi } from "@/lib/quorum/clientApi";

interface Me { name: string; title: string; role: "approver" | "pending"; email: string }

// Console for admins signed in with the LOCAL login. Every call is checked on the server against
// the session cookie; the browser only renders what the server allows.
export default function ConsolePage() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const api = useMemo(() => liveApi((url, init) => fetch(url, { ...init, credentials: "same-origin" }), "local"), []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(async (r) => (r.ok ? setMe((await r.json()).user) : (window.location.href = "/login")))
      .catch(() => (window.location.href = "/login"));
  }, []);

  if (me === undefined) return <div className="center-page"><div className="spinner" /></div>;
  if (!me) return null;

  if (me.role !== "approver") {
    return (
      <div className="center-page">
        <div className="card narrow">
          <span className="tile orange"><Icon name="clock" size={18} /></span>
          <div className="eyebrow">Account created</div>
          <h2>Welcome, {me.name.split(" ")[0]}</h2>
          <p className="muted">
            Your account is <b>pending</b>. To be admitted, one approver requests your admission and a{" "}
            <b>second, different approver</b> must co-sign it. Until then you can&apos;t see protected data or approve
            anything — that rule stops anyone from creating a sock-puppet second approver. Refresh this page once you&apos;re            admitted.
          </p>
          <button className="btn tinted" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/login"; }}>
            <Icon name="logout" size={15} /> Sign out
          </button>
        </div>
      </div>
    );
  }

  return <QuorumConsole api={api} title={me.title} headerRight={<AdminNav active="console" />} />;
}
