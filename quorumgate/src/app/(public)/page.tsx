import { Icon } from "@/components/Icon";
import { Backdrop } from "@/components/QuorumConsole";
import { OrkNetwork } from "@/components/OrkNetwork";
import { Spotlight } from "@/components/Effects";

// Public landing page for administrators: the problem, the trust constraint, and admin sign-in.
// "Admin sign in" goes to /dashboard, whose layout starts the TideCloak login.
export default function HomePage() {
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
                        <a className="btn primary small" href="/login"><Icon name="key" size={14} /> Admin sign in</a>
          </div>
        </div>
      </header>

      <main className="page">
        <section className="landing-hero">
          <div className="landing-copy">
            <span className="pill indigo"><Icon name="shield" size={12} /> Admin console · Secured by TideCloak</span>
            <h1 className="display">
              No admin should hold <span className="grad">God&nbsp;Mode</span>.
            </h1>
            <p className="lead">
              One rogue admin — or one stolen password — can export every customer record or grant themselves root.
              QuorumGate makes every high-risk action need <b>two independent people</b>, verified by a decentralised
              identity network. Not even the people who run the servers can skip it.
            </p>
            <div className="cta">
              <a className="btn primary lg" href="/login"><Icon name="key" size={18} /> Admin sign in</a>
              <a className="btn tinted lg" href="/login?mode=signup">Create admin account</a>
            </div>
            <div className="cta-note">For administrators only. The first two accounts become the founding approvers; anyone who signs up later waits to be admitted.</div>
          </div>

          {/* Decorative preview of an approval in progress */}
          <div className="preview" aria-hidden="true">
            <OrkNetwork className="ork-canvas" />
            <div className="ork-legend"><span><i style={{ background: "#5e5ce6" }} /> Tide node holds a key shard</span><span><i style={{ background: "#34c759" }} /> key forms only by threshold</span></div>
            <div className="preview-card">
              <div className="preview-top">
                <span className="tile blue"><Icon name="lock" size={16} /></span>
                <div className="row-text">
                  <div className="row-title">Decrypt customer ledger</div>
                  <div className="row-sub">Critical · requested 2 min ago</div>
                </div>
              </div>
              <div className="preview-ring">
                <svg width="120" height="120" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="48" className="ring-track" />
                  <circle cx="60" cy="60" r="48" className="ring-fill" strokeDasharray="301.6" strokeDashoffset="150.8" />
                </svg>
                <div className="ring-center"><span className="ring-num big">1</span><span className="ring-of">of 2</span></div>
              </div>
              <div className="sig-row stacked">
                <div className="slot filled"><span className="slot-avatar"><Icon name="check" size={14} /></span><div className="slot-text"><div className="slot-name">Aiman · Ops Admin</div><div className="slot-sub">Signed with device key</div></div></div>
                <div className="slot"><span className="slot-avatar" /><div className="slot-text"><div className="slot-name">Priya · Security Auditor</div><div className="slot-sub">Waiting for approval…</div></div></div>
              </div>
            </div>
            <div className="preview-float">
              <span className="tile red small"><Icon name="lock" size={13} /></span>
              Unilateral attempt blocked
            </div>
          </div>
        </section>

        <section className="feature-grid">
          <Feature tone="red" icon="bolt" title="The problem" text="Insider breaches and hijacked admin accounts are among the costliest incidents. Admin tools simply assume the admin is honest." />
          <Feature tone="orange" icon="alert" title="The trust gap" text="“Two-person approval” is meaningless if the identity system has a master key — whoever holds it can impersonate the second approver." />
          <Feature tone="green" icon="shield" title="Why TideCloak" text="Tide splits identity keys across a decentralised network, so approvals can’t be forged — and even the approver list needs a quorum to change." />
        </section>

        <section className="panel steps-panel">
          <div className="panel-head">
            <div>
              <h2>How it works</h2>
              <div className="panel-sub">Four steps, about thirty seconds.</div>
            </div>
          </div>
          <div className="steps">
            {[
              ["Admin 1 tries alone", "Decrypt the ledger or self-grant root — blocked and logged."],
              ["A request is opened", "With a reason and a SHA-256 hash. Admin 1 signs 1 of 2."],
              ["Admin 2 co-signs", "A different TideCloak login on a different device signs 2 of 2."],
              ["Time-boxed access", "Data unmasks for 10 minutes. Every view is recorded."],
            ].map(([t, d], i) => (
              <div key={t} className="step">
                <span className="step-num">{i + 1}</span>
                <div className="step-title">{t}</div>
                <div className="step-text">{d}</div>
              </div>
            ))}
          </div>
        </section>

        <footer className="foot">RMIT Hackathon 2026 · Challenge 2 · All customer data shown is fictional.</footer>
      </main>
    </div>
  );
}

function Feature({ tone, icon, title, text }: { tone: string; icon: string; title: string; text: string }) {
  return (
    <div className="panel feature">
      <span className={`tile ${tone}`}><Icon name={icon} size={18} /></span>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
