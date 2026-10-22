"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ConsoleApi, RecordsResult, Snapshot } from "@/lib/quorum/clientApi";
import { OPERATIONS, type OperationId, type Ticket } from "@/lib/quorum/types";
import { Icon } from "./Icon";

interface Props {
  api: ConsoleApi;
  title: string; // e.g. "Admin 2 · Security Auditor"
  headerRight?: React.ReactNode;
  refreshKey?: string | number; // change to force a reload (e.g. persona switch)
}

const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const short = (s: string, n = 10) => (s.length > n ? `${s.slice(0, n)}…` : s);

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
    if (api.mode !== "live") return;
    const t = setInterval(() => refresh().catch(() => {}), 4000); // see the other admin's signature arrive
    return () => clearInterval(t);
  }, [api.mode, refresh]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
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
      "Quorum ticket opened — waiting for an independent co-signer"
    );

  const me = snap?.me;
  const pending = snap?.tickets.filter((t) => t.status === "PENDING") ?? [];
  const blockedCount = snap?.audit.filter((a) => a.kind === "BLOCKED" || a.kind === "REJECTED").length ?? 0;
  const rootGrant = snap?.tickets.find((t) => t.op === "GRANT_ROOT" && t.status === "GRANTED" && t.requester.sub === me?.sub);
  const isLive = api.mode === "live";

  const myTickets = useMemo(() => snap?.tickets ?? [], [snap]);

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark"><Icon name="gate" size={20} /></span>
          <div>
            <div className="brand-name">QuorumGate</div>
            <div className="brand-sub">Zero-blind-trust critical access vault</div>
          </div>
        </div>
        <div className="topbar-right">
          <span className={`mode-pill ${isLive ? "live" : "sim"}`}>
            <span className="dot" />
            {isLive ? "LIVE · TideCloak-verified identity" : "SIMULATION · mocked identities"}
          </span>
          {me && (
            <div className="whoami">
              <div className="avatar">{me.name.slice(0, 1).toUpperCase()}</div>
              <div>
                <div className="who-name">{me.name}</div>
                <div className="who-title">{title}</div>
              </div>
            </div>
          )}
          {headerRight}
        </div>
      </header>

      {!isLive && (
        <div className="sim-banner">
          <Icon name="alert" size={16} />
          <span>
            <b>Simulation mode.</b> Identities, key thumbprints and signatures on this page are <b>mocked</b> in the
            browser — anyone can flip the persona switch. In live mode each signature comes from a separate TideCloak
            login with a DPoP-bound key, verified on the server.
          </span>
        </div>
      )}

      <section className="stats">
        <Stat icon="users" label="Signatures required" value={`${snap?.threshold ?? 2} of ${snap?.threshold ?? 2}`} hint="requester + independent approver" />
        <Stat icon="clock" label="Pending quorum tickets" value={String(pending.length)} hint="awaiting co-signature" accent={pending.length ? "warn" : undefined} />
        <Stat icon="shield" label="Unilateral attempts blocked" value={String(blockedCount)} hint="God Mode removed" accent={blockedCount ? "danger" : undefined} />
        <Stat icon="key" label="Session key (DPoP)" value={me ? short(me.keyThumbprint, 12) : "—"} hint={isLive ? "token bound to this device" : "simulated"} mono />
      </section>

      {blocked && (
        <div className="blocked-banner" role="alert">
          <div className="blocked-icon"><Icon name="lock" size={26} /></div>
          <div className="blocked-body">
            <div className="blocked-title">{blocked.text}</div>
            <div className="blocked-text">
              {me?.name} tried to <b>{OPERATIONS[blocked.op].label.toLowerCase()}</b> alone. No single administrator —
              including the person who runs the servers — can do this. Open a quorum ticket and an independent admin must
              co-sign.
            </div>
          </div>
          <button className="btn primary" onClick={() => { setRequestOp(blocked.op); setBlocked(null); }}>
            <Icon name="ticket" size={16} /> Open quorum ticket
          </button>
        </div>
      )}

      <main className="grid">
        <div className="col">
          <section className="card">
            <div className="card-head">
              <div>
                <div className="eyebrow">High-risk record set</div>
                <h2>Customer PII &amp; Financial Ledger</h2>
              </div>
              {rec?.masked === false ? (
                <span className="seal open"><Icon name="unlock" size={14} /> Quorum granted · {snap?.threshold}/{snap?.threshold} signatures</span>
              ) : (
                <span className="seal"><Icon name="lock" size={14} /> Immunity-sealed · Protected by TideCloak</span>
              )}
            </div>

            {rec?.masked === false && rec.grant?.expiresAt && (
              <div className="grant-note">
                <Icon name="check" size={14} /> Unmasked under ticket <code>{rec.grant.id}</code> · access window closes at{" "}
                {fmtTime(rec.grant.expiresAt)} · every view is written to the audit log
              </div>
            )}

            <div className="table-wrap">
              <table className={rec?.masked === false ? "unmasked" : ""}>
                <thead>
                  <tr><th>ID</th><th>Customer</th><th>National ID</th><th>Card</th><th>Balance</th><th>Risk</th></tr>
                </thead>
                <tbody>
                  {(rec?.records ?? []).map((r) => (
                    <tr key={r.id}>
                      <td className="mono dim">{r.id}</td>
                      <td>{r.name}</td>
                      <td className="mono">{r.nationalId}</td>
                      <td className="mono">{r.card}</td>
                      <td className="mono">{r.balance}</td>
                      <td><span className={`risk ${r.risk.toLowerCase()}`}>{r.risk}</span></td>
                    </tr>
                  ))}
                  {!rec && <tr><td colSpan={6} className="dim">Loading sealed records…</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="sample-note">Sample data — all names and numbers are fictional.</div>

            {rec?.masked !== false && (
              <div className="actions">
                <button className="btn danger-ghost" disabled={!!busy} onClick={() => tryUnilateral("UNMASK_LEDGER")}>
                  <Icon name="bolt" size={16} /> Decrypt ledger now (single admin)
                </button>
                <button className="btn primary" disabled={!!busy} onClick={() => setRequestOp("UNMASK_LEDGER")}>
                  <Icon name="ticket" size={16} /> Request quorum access
                </button>
              </div>
            )}
          </section>

          <section className="card">
            <div className="card-head">
              <div>
                <div className="eyebrow">Privileged operation</div>
                <h2>Elevated production privileges</h2>
              </div>
              {rootGrant ? (
                <span className="seal open"><Icon name="unlock" size={14} /> Root window active</span>
              ) : (
                <span className="seal"><Icon name="lock" size={14} /> Quorum-gated</span>
              )}
            </div>
            <p className="muted">
              {rootGrant
                ? `Root maintenance window granted to ${rootGrant.requester.name} until ${fmtTime(rootGrant.expiresAt!)} under ticket ${rootGrant.id}.`
                : "Grants unrestricted production access for a time-boxed maintenance window. A compromised admin account alone cannot self-elevate."}
            </p>
            {!rootGrant && (
              <div className="actions">
                <button className="btn danger-ghost" disabled={!!busy} onClick={() => tryUnilateral("GRANT_ROOT")}>
                  <Icon name="bolt" size={16} /> Self-grant root (single admin)
                </button>
                <button className="btn" disabled={!!busy} onClick={() => setRequestOp("GRANT_ROOT")}>
                  <Icon name="ticket" size={16} /> Request with quorum
                </button>
              </div>
            )}
          </section>
        </div>

        <div className="col">
          <section className="card">
            <div className="card-head">
              <div>
                <div className="eyebrow">Multi-party approval</div>
                <h2>Quorum queue</h2>
              </div>
              <span className="count-pill">{pending.length} pending</span>
            </div>
            {myTickets.length === 0 && (
              <div className="empty">
                <Icon name="ticket" size={22} />
                <div>No tickets yet. High-risk actions start here.</div>
              </div>
            )}
            <div className="tickets">
              {myTickets.map((t) => (
                <TicketCard
                  key={t.id}
                  t={t}
                  meSub={me?.sub}
                  busy={!!busy}
                  onApprove={() => run("approve", () => api.approve(t.id), "Signature recorded")}
                  onDeny={() => run("deny", () => api.deny(t.id), "Request denied")}
                />
              ))}
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <div>
                <div className="eyebrow">Tamper-evident trail</div>
                <h2>Audit log</h2>
              </div>
            </div>
            <ol className="audit">
              {(snap?.audit ?? []).slice(0, 14).map((a, i) => (
                <li key={i} className={`ev ${a.kind.toLowerCase()}`}>
                  <span className="ev-time mono">{fmtTime(a.at)}</span>
                  <span className={`ev-kind ${a.kind.toLowerCase()}`}>{a.kind}</span>
                  <span className="ev-text"><b>{a.actor}</b> — {a.detail}{a.ticketId ? <> · <code>{a.ticketId}</code></> : null}</span>
                </li>
              ))}
              {snap && snap.audit.length === 0 && <li className="dim">No events yet.</li>}
            </ol>
          </section>
        </div>
      </main>

      <TrustLayers live={isLive} />

      {requestOp && (
        <div className="modal-bg" onClick={() => setRequestOp(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="eyebrow">New quorum ticket · {OPERATIONS[requestOp].risk}</div>
            <h3>{OPERATIONS[requestOp].label}</h3>
            <p className="muted">{OPERATIONS[requestOp].description}</p>
            <label className="label" htmlFor="reason">Business justification (recorded in the ticket hash)</label>
            <textarea
              id="reason"
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Regulator request BNM-2026-114: verify flagged high-risk accounts"
              rows={3}
            />
            <div className="sig-preview">
              <Slot filled label={me?.name ?? "You"} sub="Requester · signs now" />
              <Slot label="Independent approver" sub="different TideCloak identity" />
            </div>
            <div className="actions end">
              <button className="btn" onClick={() => setRequestOp(null)}>Cancel</button>
              <button className="btn primary" disabled={busy === "create" || reason.trim().length < 8} onClick={submitRequest}>
                <Icon name="pen" size={16} /> Sign &amp; open ticket
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast ${toast.kind}`}>{toast.text}</div>}
    </div>
  );
}

function TicketCard({ t, meSub, busy, onApprove, onDeny }: { t: Ticket; meSub?: string; busy: boolean; onApprove: () => void; onDeny: () => void }) {
  const mine = t.requester.sub === meSub;
  const signed = t.signatures.some((s) => s.sub === meSub);
  const slots = Array.from({ length: t.threshold }, (_, i) => t.signatures[i]);
  return (
    <article className={`ticket ${t.status.toLowerCase()}`}>
      <div className="ticket-top">
        <div>
          <div className="ticket-id mono">{t.id}</div>
          <div className="ticket-op">{OPERATIONS[t.op].label}</div>
        </div>
        <span className={`status ${t.status.toLowerCase()}`}>
          {t.status === "GRANTED" ? `QUORUM GRANTED (${t.signatures.length}/${t.threshold})` : t.status === "PENDING" ? `PENDING ${t.signatures.length}/${t.threshold}` : t.status}
        </span>
      </div>
      <div className="ticket-reason">“{t.reason}”</div>
      <div className="ticket-meta mono">tx {t.hash.slice(0, 16)}…{t.hash.slice(-6)}</div>
      <div className="sigs">
        {slots.map((s, i) =>
          s ? (
            <Slot key={i} filled label={s.name} sub={`${s.role === "REQUESTER" ? "Requester" : "Approver"} · ${fmtTime(s.at)} · key ${short(s.keyThumbprint, 8)}`} />
          ) : (
            <Slot key={i} label="Awaiting signature" sub="independent admin" />
          )
        )}
      </div>
      {t.status === "DENIED" && t.deniedBy && <div className="muted small">Denied by {t.deniedBy.name} at {fmtTime(t.deniedBy.at)}</div>}
      {t.status === "PENDING" && (
        <div className="actions">
          {mine || signed ? (
            <>
              <button className="btn ghost" disabled={busy} onClick={onApprove} title="The server will refuse this — four-eyes rule">
                <Icon name="pen" size={15} /> Try to self-approve
              </button>
              <span className="muted small">Waiting for an independent admin…</span>
            </>
          ) : (
            <>
              <button className="btn primary" disabled={busy} onClick={onApprove}>
                <Icon name="pen" size={15} /> Cryptographically sign &amp; approve
              </button>
              <button className="btn danger-ghost" disabled={busy} onClick={onDeny}>Deny</button>
            </>
          )}
        </div>
      )}
    </article>
  );
}

function Slot({ filled, label, sub }: { filled?: boolean; label: string; sub: string }) {
  return (
    <div className={`slot ${filled ? "filled" : ""}`}>
      <span className="slot-dot">{filled ? <Icon name="check" size={13} /> : null}</span>
      <div>
        <div className="slot-label">{label}</div>
        <div className="slot-sub">{sub}</div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, hint, accent, mono }: { icon: string; label: string; value: string; hint: string; accent?: "warn" | "danger"; mono?: boolean }) {
  return (
    <div className={`stat ${accent ?? ""}`}>
      <div className="stat-icon"><Icon name={icon} size={18} /></div>
      <div>
        <div className="stat-label">{label}</div>
        <div className={`stat-value ${mono ? "mono" : ""}`}>{value}</div>
        <div className="stat-hint">{hint}</div>
      </div>
    </div>
  );
}

function TrustLayers({ live }: { live: boolean }) {
  const layers = [
    { t: "Threshold identity (TideCloak)", d: "Logins are verified by a decentralised network of Tide nodes. No server — not even ours or the identity provider's — holds a whole key, so nobody can mint a token for Admin 2 and approve their own request.", real: true },
    { t: "Device-bound sessions (DPoP)", d: "Each token is bound to a key on the signer's device. A stolen token replayed from another machine is rejected by the server.", real: true },
    { t: "Server-side quorum enforcement", d: "The ledger API verifies the token, the DPoP proof and the role, then releases plaintext only under a GRANTED ticket. The UI cannot bypass it.", real: true },
    { t: "Governed approver roster (IGA)", d: "Who holds the quorum-approver role is controlled by TideCloak change requests. Adding a sock-puppet approver is itself a quorum-approved action.", real: true },
    { t: "Ticket storage", d: "Tickets and the audit log are kept in server memory for this prototype and reset on restart. Production would persist them to an append-only store.", real: false },
  ];
  return (
    <section className="card trust">
      <div className="card-head">
        <div>
          <div className="eyebrow">Why this can&apos;t be faked</div>
          <h2>Trust layers</h2>
        </div>
      </div>
      <div className="layers">
        {layers.map((l, i) => (
          <div key={i} className="layer">
            <div className="layer-num">{i + 1}</div>
            <div>
              <div className="layer-title">
                {l.t}{" "}
                {l.real ? (
                  <span className={`tag ${live ? "real" : "simtag"}`}>{live ? "REAL" : "REAL IN LIVE MODE"}</span>
                ) : (
                  <span className="tag proto">PROTOTYPE</span>
                )}
              </div>
              <div className="muted small">{l.d}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
