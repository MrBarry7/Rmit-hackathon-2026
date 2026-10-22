import Link from "next/link";
import { Icon } from "@/components/Icon";

// Public landing page: the problem, the trust constraint, and two ways in.
// "Sign in" goes to /dashboard, whose layout starts the TideCloak login.
export default function HomePage() {
  return (
    <div className="landing">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark"><Icon name="gate" size={20} /></span>
          <div>
            <div className="brand-name">QuorumGate</div>
            <div className="brand-sub">Zero-blind-trust critical access vault</div>
          </div>
        </div>
      </header>

      <section className="hero">
        <div className="eyebrow">Build without blind trust</div>
        <h1>
          No single admin should hold <span className="grad">God Mode</span>.
        </h1>
        <p className="lead">
          Today one IT administrator — or one stolen admin password — can export a bank&apos;s entire customer ledger or
          grant themselves root, and nobody finds out until it&apos;s in the news. QuorumGate makes every high-risk
          action require two independent, cryptographically verified people. Not even the people who run the servers
          can skip it.
        </p>
        <div className="hero-cta">
          {/* Plain <a>: /dashboard is a separate root layout (with the TideCloak provider). */}
          <a className="btn primary lg" href="/dashboard"><Icon name="key" size={18} /> Sign in with TideCloak</a>
          <Link className="btn lg" href="/simulation"><Icon name="swap" size={18} /> Try the simulation</Link>
        </div>
        <div className="hero-note muted small">
          Live console: real TideCloak login, server-verified. Simulation: mocked identities, runs offline.
        </div>
      </section>

      <section className="pillars">
        <div className="pillar">
          <div className="pillar-icon danger"><Icon name="bolt" /></div>
          <h3>The problem</h3>
          <p className="muted">Insider breaches and hijacked admin accounts are among the costliest incidents. Admin consoles assume the admin is trustworthy.</p>
        </div>
        <div className="pillar">
          <div className="pillar-icon warn"><Icon name="alert" /></div>
          <h3>The trust constraint</h3>
          <p className="muted">&ldquo;Two-person approval&rdquo; is meaningless if the identity system itself has a master key — whoever holds it can impersonate the second approver.</p>
        </div>
        <div className="pillar">
          <div className="pillar-icon ok"><Icon name="shield" /></div>
          <h3>Why TideCloak</h3>
          <p className="muted">Tide splits identity keys across a decentralised network. No server holds them whole, so approvals can&apos;t be forged — and even the approver list is governed by quorum.</p>
        </div>
      </section>

      <section className="flow">
        {[
          ["1", "Admin 1 tries to act alone", "Decrypt the ledger or self-grant root → blocked, logged."],
          ["2", "A quorum ticket is opened", "Justification + SHA-256 transaction hash, requester signs 1/2."],
          ["3", "Admin 2 co-signs", "A different TideCloak identity, on a different device key, signs 2/2."],
          ["4", "Time-boxed access", "Server unmasks for 10 minutes; every view is audited."],
        ].map(([n, t, d]) => (
          <div key={n} className="flow-step">
            <div className="flow-num">{n}</div>
            <div>
              <div className="flow-title">{t}</div>
              <div className="muted small">{d}</div>
            </div>
          </div>
        ))}
      </section>

      <footer className="foot muted small">RMIT Hackathon 2026 · Challenge 2 · All customer data shown is fictional sample data.</footer>
    </div>
  );
}
