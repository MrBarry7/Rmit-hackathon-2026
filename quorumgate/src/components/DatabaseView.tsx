"use client";

import { useCallback, useEffect, useState } from "react";
import { Backdrop } from "./QuorumConsole";
import { Spotlight } from "./Effects";
import { Icon } from "./Icon";

type Row = Record<string, unknown>;
interface DbData {
  users: Row[];
  tickets: Row[];
  signatures: Row[];
  audit: Row[];
  customers: Row[];
  customersMasked: boolean;
  file: string;
}

const TABLES: { key: keyof Omit<DbData, "customersMasked" | "file">; label: string; icon: string; note: string }[] = [
  { key: "users", label: "Admin accounts", icon: "users", note: "Pending accounts need two approvers to be admitted. Password hashes are never sent to the browser." },
  { key: "tickets", label: "Approval tickets", icon: "ticket", note: "Each ticket is sealed with a SHA-256 hash of its content." },
  { key: "signatures", label: "Signatures", icon: "pen", note: "One row per admin who signed a ticket." },
  { key: "audit", label: "Audit log", icon: "clock", note: "Every blocked attempt, signature, grant and data view." },
  { key: "customers", label: "Customer records", icon: "lock", note: "" },
];

const fmt = (k: string, v: unknown) => {
  if (v === null || v === undefined || v === "") return <span className="dim">—</span>;
  const s = String(v);
  if (/(_at|^at)$/.test(k) && !isNaN(Date.parse(s))) return new Date(s).toLocaleString([], { dateStyle: "short", timeStyle: "medium" });
  if (k === "hash" || k === "key_thumbprint" || k === "id" && s.length > 20) return <span className="mono" title={s}>{s.slice(0, 12)}…</span>;
  if (k === "role" || k === "status" || k === "kind" || k === "risk") return <span className={`pill tiny tag-${s.toLowerCase()}`}>{s.toLowerCase()}</span>;
  return s;
};

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

/** Database viewer, shared by the local-login (/database) and TideCloak (/dashboard/database) pages. */
export function DatabaseView({ fetcher, nav, consoleHref, onUnauthorized }: { fetcher: Fetcher; nav: React.ReactNode; consoleHref: string; onUnauthorized: () => void }) {
  const [data, setData] = useState<DbData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<(typeof TABLES)[number]["key"]>("users");
  const [flash, setFlash] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Opens an ADMIT_ADMIN quorum ticket. A DIFFERENT approver must co-sign it in the console.
  const admit = async (u: Row) => {
    setBusyId(String(u.id));
    try {
      const res = await fetcher("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", op: "ADMIT_ADMIN", targetId: u.id, reason: `Admit ${u.name} (${u.title}) as a quorum approver` }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Could not request admission");
      setFlash({ kind: "ok", text: `Admission requested for ${u.name} — a second approver must co-sign in the console` });
      await load();
    } catch (e) {
      setFlash({ kind: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusyId(null);
    }
  };
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 4500);
    return () => clearTimeout(t);
  }, [flash]);

  const load = useCallback(async () => {
    const r = await fetcher("/api/db");
    if (r.status === 401) { onUnauthorized(); return; }
    const d = await r.json();
    if (!r.ok) { setError(d.error || "Could not load the database"); return; }
    setData(d);
  }, [fetcher, onUnauthorized]);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  const rows = data ? data[tab] : [];

  const admitCell = (u: Row) => {
    if (u.role !== "pending") return <span className="dim">—</span>;
    const open = data?.tickets.find((t) => t.op === "ADMIT_ADMIN" && t.target_id === u.id && t.status === "PENDING");
    if (open) return <a className="pill tiny tag-pending" href={consoleHref}>Awaiting 2nd signature · {String(open.id)}</a>;
    return (
      <button className="btn primary small" disabled={busyId === u.id} onClick={() => admit(u)}>
        <Icon name="users" size={13} /> Admit
      </button>
    );
  };
  const cols = rows.length ? Object.keys(rows[0]) : [];
  const meta = TABLES.find((t) => t.key === tab)!;

  return (
    <div className="app">
      <Backdrop />
      <Spotlight />
      <header className="nav">
        <div className="nav-inner">
          <a className="brand" href="/">
            <span className="brand-mark"><Icon name="gate" size={18} /></span>
            <span className="brand-name">QuorumGate</span>
          </a>
          <div className="nav-right">{nav}</div>
        </div>
      </header>

      <main className="page">
        <div className="greeting">
          <div>
            <div className="kicker">SQLite · {data?.file ?? "data/quorumgate.db"}</div>
            <h1>Database</h1>
          </div>
          <span className="chip"><span className="mode-dot live-dot" /> Live · refreshes every 4s</span>
        </div>

        {error && <div className="notice"><Icon name="alert" size={16} /> {error}</div>}
        {flash && <div className={`toast ${flash.kind}`}>{flash.text}</div>}

        <div className="db-tabs">
          {TABLES.map((t) => (
            <button key={t.key} className={`db-tab ${tab === t.key ? "on" : ""}`} onClick={() => setTab(t.key)}>
              <span className="tile soft small"><Icon name={t.icon} size={13} /></span>
              <span className="db-tab-label">{t.label}</span>
              <span className="db-count">{data ? data[t.key].length : "–"}</span>
            </button>
          ))}
        </div>

        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>{meta.label}</h2>
              <div className="panel-sub">
                {tab === "customers"
                  ? data?.customersMasked
                    ? "Masked — you need an approved quorum ticket to see real values, even here."
                    : "Unmasked under your approved quorum ticket. This view is subject to the same rule as the console."
                  : meta.note}
              </div>
            </div>
            {tab === "customers" && (
              <span className={`pill ${data?.customersMasked ? "indigo" : "green"}`}>
                <Icon name={data?.customersMasked ? "lock" : "unlock"} size={12} /> {data?.customersMasked ? "Masked" : "Unmasked"}
              </span>
            )}
          </div>

          {rows.length === 0 ? (
            <div className="empty"><span className="empty-icon"><Icon name={meta.icon} size={20} /></span>No rows yet</div>
          ) : (
            <div className="db-table-wrap">
              <table className="db-table">
                <thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}{tab === "users" && <th>action</th>}</tr></thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i}>
                      {cols.map((c) => <td key={c}>{fmt(c, r[c])}</td>)}
                      {tab === "users" && <td>{admitCell(r)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
