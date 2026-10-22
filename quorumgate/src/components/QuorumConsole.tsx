"use client";

import { useCallback, useEffect, useState } from "react";
import type { ConsoleApi, RecordsResult, Snapshot } from "@/lib/quorum/clientApi";
import { OPERATIONS, type OperationId, type Ticket } from "@/lib/quorum/types";
import { Icon } from "./Icon";
import { CountUp, ScrambleText, Spotlight, TiltCard } from "./Effects";

interface Props {
  api: ConsoleApi;
  title: string; // e.g. "Admin 2 · Security Auditor"
  headerRight?: React.ReactNode;
  refreshKey?: string | number; // change to force a reload (e.g. persona switch)
}

const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const short = (s: string, n = 10) => (s.length > n ? `${s.slice(0, n)}…` : s);
const initials = (name: string) => name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

export function QuorumConsole({ api, title, headerRight, refreshKey }: Props) {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [rec, setRec] = useState<RecordsResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [blocked, setBlocked] = useState<{ op: OperationId; text: string } | null>(null);
  const [requestOp, setRequestOp] = useState<OperationId | null>(null);
  const [reason, setReason] = useState("");

  const refresh = useCallback(async () => {
    const [s, r] = await Promise.all([api.load(), api.records()]);
    setSnap(s);
    setRec(r);
  }, [api]);

  useEffect(() => {
    setBlocked(null);
    refresh().catch((e) => setToast({ kind: "err", text: e.message }));
  }, [refresh, refreshKey]);

  useEffect(() => {
    if (api.mode === "simulation") return;
    const t = setInterval(() => refresh().catch(() => {}), 4000); // see the other admin's signature arrive
    return () => clearInterval(t);
  }, [api.mode, refresh]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const run = async (label: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(label);
    try {
      await fn();
      await refresh();
      if (ok) setToast({ kind: "ok", text: ok });
    } catch (e) {
      setToast({ kind: "err", text: e instanceof Error ? e.message : String(e) });
      await refresh().catch(() => {});
    } finally {
      setBusy(null);
    }
  };

  const tryUnilateral = (op: OperationId) =>
    run("unilateral-" + op, async () => {
      if (op === "UNMASK_LEDGER") {
        const r = await api.records(true);
        setRec(r);
        if (r.blocked) setBlocked({ op, text: r.blocked });
      } else {
        // Root grant has no direct path at all — the only door is the quorum ticket.
        setBlocked({ op, text: "UNILATERAL ATTEMPT BLOCKED — quorum approval required" });
      }
    });

  const submitRequest = () =>
    requestOp &&
    run(
      "create",
      async () => {
        await api.create(requestOp, reason);
        setRequestOp(null);
        setReason("");
        setBlocked(null);
      },
      "Ticket opened — waiting for a second signature"
    );

  const me = snap?.me;
  const tickets = snap?.tickets ?? [];
  const pending = tickets.filter((t) => t.status === "PENDING");
  const blockedCount = snap?.audit.filter((a) => a.kind === "BLOCKED" || a.kind === "REJECTED").length ?? 0;
  const rootGrant = tickets.find((t) => t.op === "GRANT_ROOT" && t.status === "GRANTED" && t.requester.sub === me?.sub);
  const focus = pending[0] ?? tickets[0];
  const unlocked = rec?.masked === false;
  const isLive = api.mode !== "simulation";
  const now = useNow(unlocked || !!rootGrant);

  const remaining = (iso?: string) => {
    if (!iso) return "";
    const s = Math.max(0, Math.floor((Date.parse(iso) - now) / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };

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
          <div className="nav-right">
            <span className={`mode ${isLive ? "live" : "sim"}`}>
              <span className="mode-dot" />
              {api.mode === "live" ? "Live · TideCloak" : api.mode === "local" ? "Live · Local login" : "Simulation"}
            </span>
            {headerRight}
            {me && (
              <div className="me">
                <span className="me-avatar">{initials(me.name)}</span>
                <span className="me-text">
                  <span className="me-name">{me.name}</span>
                  <span className="me-role">{title}</span>
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="page">
        {!isLive && (
          <div className="notice">
            <Icon name="alert" size={16} />
            <span>
              <b>Simulation mode.</b> The two admins, their keys and signatures are mocked in this browser. In live mode
              every signature comes from a separate TideCloak login with a device-bound key, checked by the server.
            </span>
          </div>
        )}

        <div className="greeting">
          <div>
            <div className="kicker">{new Date().toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })}</div>
            <h1>{me ? `Hello, ${me.name.split(" ")[0]}` : "Loading…"}</h1>
          </div>
          <div className="chips">
            <Chip icon="users" label={`${snap?.threshold ?? 2}-of-${snap?.threshold ?? 2} quorum`} />
            <Chip icon="clock" label={<><CountUp value={pending.length} /> pending</>} tone={pending.length ? "orange" : undefined} />
            <Chip icon="shield" label={<><CountUp value={blockedCount} /> blocked</>} tone={blockedCount ? "red" : undefined} />
          </div>
        </div>

        {blocked && (
          <div className="alert" role="alert">
            <div className="alert-icon"><Icon name="lock" size={24} /></div>
            <div className="alert-body">
              <div className="alert-title">Unilateral attempt blocked</div>
              <div className="alert-text">
                You tried to {OPERATIONS[blocked.op].label.toLowerCase()} on your own. Nobody can do this alone — not even
                the people who run the servers. Ask a second admin to co-sign.
              </div>
            </div>
            <button className="btn primary" onClick={() => { setRequestOp(blocked.op); setBlocked(null); }}>
              Request approval
            </button>
            <button className="icon-btn" aria-label="Dismiss" onClick={() => setBlocked(null)}>✕</button>
          </div>
        )}

        <section className="hero-grid">
          {/* Wallet-style card for the protected record set */}
          <TiltCard className={`vault ${unlocked ? "open" : ""}`}>
            <div className="vault-top">
              <span className="vault-badge">
                <Icon name={unlocked ? "unlock" : "lock"} size={14} />
                {unlocked ? "Unlocked by quorum" : "Sealed · Protected by TideCloak"}
              </span>
              <span className="vault-chip" aria-hidden="true" />
            </div>
            <div className="vault-title">Customer Ledger</div>
            <div className="vault-sub">PII &amp; financial records · {rec?.records.length ?? 6} customers</div>
            <div className="vault-bottom">
              {unlocked ? (
                <div className="vault-timer">
                  <span className="vault-timer-num mono">{remaining(rec?.grant?.expiresAt)}</span>
                  <span>left in access window · ticket {rec?.grant?.id}</span>
                </div>
              ) : (
                <div className="vault-actions">
                  <button className="btn light" disabled={!!busy} onClick={() => setRequestOp("UNMASK_LEDGER")}>
                    <Icon name="ticket" size={16} /> Request access
                  </button>
                  <button className="btn glass" disabled={!!busy} onClick={() => tryUnilateral("UNMASK_LEDGER")}>
                    <Icon name="bolt" size={16} /> Decrypt alone
                  </button>
                </div>
              )}
            </div>
          </TiltCard>

          <div className="side-stack">
            <div className="panel ring-panel">
              <QuorumRing have={focus?.signatures.length ?? 0} need={focus?.threshold ?? snap?.threshold ?? 2} granted={focus?.status === "GRANTED"} />
              <div className="ring-text">
                <div className="ring-label">{focus ? (focus.status === "PENDING" ? "Waiting for signatures" : focus.status === "GRANTED" ? "Quorum reached" : `Ticket ${focus.status.toLowerCase()}`) : "No active request"}</div>
                <div className="ring-sub">{focus ? `${OPERATIONS[focus.op].label}${focus.target ? `: ${focus.target.name}` : ""}` : "High-risk actions need two people."}</div>
                {focus && <div className="ring-id mono">{focus.id}</div>}
              </div>
            </div>

            <div className="panel root-panel">
              <div className="row-head">
                <span className="tile purple"><Icon name="key" size={16} /></span>
                <div className="row-text">
                  <div className="row-title">Root privileges</div>
                  <div className="row-sub">{rootGrant ? `Active · ${remaining(rootGrant.expiresAt)} left` : "Time-boxed production access"}</div>
                </div>
                {rootGrant ? <span className="pill green">Active</span> : <span className="pill">Locked</span>}
              </div>
              {!rootGrant && (
                <div className="row-actions">
                  <button className="btn tinted" disabled={!!busy} onClick={() => setRequestOp("GRANT_ROOT")}>Request</button>
                  <button className="btn plain-red" disabled={!!busy} onClick={() => tryUnilateral("GRANT_ROOT")}>Self-grant</button>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Records</h2>
              <div className="panel-sub">{unlocked ? "Visible to you for this access window. Every view is logged." : "Masked for everyone until two admins approve."}</div>
            </div>
            <span className={`pill ${unlocked ? "green" : "indigo"}`}>
              <Icon name={unlocked ? "unlock" : "lock"} size={12} /> {unlocked ? "Unmasked" : "Masked"}
            </span>
          </div>
          <div className="records">
            {(rec?.records ?? []).map((r, i) => (
              <div key={r.id} className={`record ${unlocked ? "reveal" : ""}`}>
                <span className="record-avatar">{unlocked ? initials(r.name) : "••"}</span>
                <div className="record-main">
                  <div className="record-name"><ScrambleText text={r.name} active={unlocked} delay={i * 90} /></div>
                  <div className="record-meta mono">{r.id} · ID <ScrambleText text={r.nationalId} active={unlocked} delay={i * 90} /> · <ScrambleText text={r.card} active={unlocked} delay={i * 90 + 60} /></div>
                </div>
                <div className="record-right">
                  <div className="record-balance mono"><ScrambleText text={r.balance} active={unlocked} delay={i * 90 + 120} /></div>
                  <span className={`risk ${r.risk.toLowerCase()}`}>{r.risk.toLowerCase()} risk</span>
                </div>
              </div>
            ))}
            {!rec && <div className="empty">Loading…</div>}
          </div>
          <div className="footnote">Sample data — all names and numbers are fictional.</div>
        </section>

        <section className="two-col">
          <div className="panel">
            <div className="panel-head">
              <div>
                <h2>Approvals</h2>
                <div className="panel-sub">Requests need a second, independent signature.</div>
              </div>
              <span className="pill">{pending.length} pending</span>
            </div>
            {tickets.length === 0 && (
              <div className="empty">
                <span className="empty-icon"><Icon name="ticket" size={22} /></span>
                No requests yet
              </div>
            )}
            <div className="tickets">
              {tickets.map((t) => (
                <TicketCard
                  key={t.id}
                  t={t}
                  meSub={me?.sub}
                  busy={!!busy}
                  onApprove={() => run("approve", () => api.approve(t.id), "Signature added")}
                  onDeny={() => run("deny", () => api.deny(t.id), "Request denied")}
                />
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <div>
                <h2>Activity</h2>
                <div className="panel-sub">Every attempt, signature and view.</div>
              </div>
            </div>
            <ol className="timeline">
              {(snap?.audit ?? []).slice(0, 14).map((a, i) => (
                <li key={i} className={`tl ${a.kind.toLowerCase()}`}>
                  <span className="tl-dot" />
                  <div className="tl-body">
                    <div className="tl-top">
                      <span className="tl-kind">{a.kind.toLowerCase()}</span>
                      <span className="tl-time mono">{fmtTime(a.at)}</span>
                    </div>
                    <div className="tl-text"><b>{a.actor}</b> {a.detail}</div>
                  </div>
                </li>
              ))}
              {snap && snap.audit.length === 0 && <li className="empty">Nothing yet</li>}
            </ol>
          </div>
        </section>

        <TrustLayers mode={api.mode} keyThumbprint={me?.keyThumbprint} />
      </main>

      {requestOp && (
        <div className="sheet-bg" onClick={() => setRequestOp(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-grabber" />
            <span className={`pill ${OPERATIONS[requestOp].risk === "CRITICAL" ? "red" : "orange"}`}>{OPERATIONS[requestOp].risk.toLowerCase()} risk</span>
            <h3>{OPERATIONS[requestOp].label}</h3>
            <p className="muted">{OPERATIONS[requestOp].description}</p>
            <label className="field-label" htmlFor="reason">Why do you need this?</label>
            <textarea
              id="reason"
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Regulator request BNM-2026-114 — verify flagged accounts"
              rows={3}
            />
            <div className="sig-row">
              <Slot filled name={me?.name ?? "You"} sub="You · signs now" />
              <Slot name="Second admin" sub="Different TideCloak login" />
            </div>
            <div className="sheet-actions">
              <button className="btn tinted" onClick={() => setRequestOp(null)}>Cancel</button>
              <button className="btn primary" disabled={busy === "create" || reason.trim().length < 8} onClick={submitRequest}>
                Sign &amp; send
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast ${toast.kind}`}>{toast.text}</div>}
    </div>
  );
}

export function Backdrop() {
  return (
    <div className="backdrop" aria-hidden="true">
      <span className="blob b1" />
      <span className="blob b2" />
      <span className="blob b3" />
    </div>
  );
}

function QuorumRing({ have, need, granted }: { have: number; need: number; granted: boolean }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const pct = need ? Math.min(have / need, 1) : 0;
  return (
    <div className={`ring ${granted ? "done" : ""}`}>
      <svg width="88" height="88" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={r} className="ring-track" />
        <circle cx="44" cy="44" r={r} className="ring-fill" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} />
      </svg>
      <div className="ring-center">
        <span className="ring-num">{have}</span>
        <span className="ring-of">of {need}</span>
      </div>
    </div>
  );
}

function TicketCard({ t, meSub, busy, onApprove, onDeny }: { t: Ticket; meSub?: string; busy: boolean; onApprove: () => void; onDeny: () => void }) {
  const mine = t.requester.sub === meSub;
  const signed = t.signatures.some((s) => s.sub === meSub);
  const slots = Array.from({ length: t.threshold }, (_, i) => t.signatures[i]);
  const statusLabel = t.status === "GRANTED" ? "Approved" : t.status === "PENDING" ? `${t.signatures.length} of ${t.threshold}` : t.status.toLowerCase();
  return (
    <article className={`ticket ${t.status.toLowerCase()}`}>
      <div className="ticket-top">
        <span className={`tile ${t.op === "UNMASK_LEDGER" ? "blue" : t.op === "ADMIT_ADMIN" ? "green" : "purple"}`}>
          <Icon name={t.op === "UNMASK_LEDGER" ? "lock" : t.op === "ADMIT_ADMIN" ? "users" : "key"} size={16} />
        </span>
        <div className="row-text">
          <div className="row-title">{OPERATIONS[t.op].label}{t.target ? `: ${t.target.name}` : ""}</div>
          <div className="row-sub">by {t.requester.name} · {fmtTime(t.createdAt)}</div>
        </div>
        <span className={`pill ${t.status === "GRANTED" ? "green" : t.status === "PENDING" ? "orange" : t.status === "DENIED" ? "red" : ""}`}>{statusLabel}</span>
      </div>
      <div className="ticket-reason">“{t.reason}”</div>
      <div className="sig-row">
        {slots.map((s, i) =>
          s ? (
            <Slot key={i} filled name={s.name} sub={`${s.role === "REQUESTER" ? "Requested" : "Approved"} ${fmtTime(s.at)} · key ${short(s.keyThumbprint, 8)}`} />
          ) : (
            <Slot key={i} name="Waiting…" sub="Independent admin" />
          )
        )}
      </div>
      <div className="ticket-hash mono">tx {t.hash.slice(0, 20)}…{t.hash.slice(-6)}</div>
      {t.status === "PENDING" && (
        <div className="row-actions">
          {mine || signed ? (
            <button className="btn tinted" disabled={busy} onClick={onApprove} title="The server will refuse this — four-eyes rule">
              Try to self-approve
            </button>
          ) : (
            <>
              <button className="btn primary" disabled={busy} onClick={onApprove}>
                <Icon name="pen" size={15} /> Sign &amp; approve
              </button>
              <button className="btn plain-red" disabled={busy} onClick={onDeny}>Deny</button>
            </>
          )}
        </div>
      )}
    </article>
  );
}

function Slot({ filled, name, sub }: { filled?: boolean; name: string; sub: string }) {
  return (
    <div className={`slot ${filled ? "filled" : ""}`}>
      <span className="slot-avatar">{filled ? <Icon name="check" size={14} /> : null}</span>
      <div className="slot-text">
        <div className="slot-name">{name}</div>
        <div className="slot-sub">{sub}</div>
      </div>
    </div>
  );
}

function Chip({ icon, label, tone }: { icon: string; label: React.ReactNode; tone?: "orange" | "red" }) {
  return (
    <span className={`chip ${tone ?? ""}`}>
      <Icon name={icon} size={14} /> {label}
    </span>
  );
}

type Mode = "live" | "local" | "simulation";
type Status = { label: string; tone: "green" | "orange" | "" };

function TrustLayers({ mode, keyThumbprint }: { mode: Mode; keyThumbprint?: string }) {
  const real: Status = { label: "Real", tone: "green" };
  const needsTide: Status = { label: "Needs TideCloak", tone: "orange" };
  const simulated: Status = { label: "Simulated", tone: "orange" };
  const layers: { icon: string; t: string; d: string; s: Record<Mode, Status> }[] = [
    { icon: "users", t: "Threshold identity", d: "With TideCloak, logins are signed by a decentralised Tide network. No single server holds a whole key, so nobody can fake the second admin.", s: { live: real, local: needsTide, simulation: simulated } },
    { icon: "key", t: "Device-bound sessions", d: `Each signature is tied to the signer's own session key${keyThumbprint ? ` (yours: ${short(keyThumbprint, 12)})` : ""}. TideCloak adds DPoP so stolen tokens are useless.`, s: { live: real, local: { label: "Session key", tone: "green" }, simulation: simulated } },
    { icon: "shield", t: "Server enforcement", d: "The server checks who you are and your role, then unmasks data only under an approved ticket. The browser can't bypass it.", s: { live: real, local: real, simulation: simulated } },
    { icon: "check", t: "Governed approvers", d: "Only the two founding admins approve. New sign-ups wait as 'pending' and can't touch data. With TideCloak, admitting one is a quorum-approved change request.", s: { live: real, local: { label: "Partial", tone: "orange" }, simulation: simulated } },
    { icon: "clock", t: "Tamper-evident records", d: "Tickets, signatures and the audit log are stored in a SQLite database, each ticket sealed with a SHA-256 hash.", s: { live: real, local: real, simulation: { label: "In browser", tone: "" } } },
  ];
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Why it can&apos;t be faked</h2>
          <div className="panel-sub">Five layers between one admin and your customers&apos; data.</div>
        </div>
      </div>
      <div className="layers">
        {layers.map((l) => (
          <div key={l.t} className="layer">
            <span className="tile soft"><Icon name={l.icon} size={16} /></span>
            <div className="layer-title">{l.t}</div>
            <div className="layer-text">{l.d}</div>
            <span className={`pill tiny ${l.s[mode].tone}`}>{l.s[mode].label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
