"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { Backdrop } from "@/components/QuorumConsole";
import { Spotlight } from "@/components/Effects";
import { DEMO_LOGINS, DEMO_PASSWORD, JOB_TITLE_OPTIONS } from "@/lib/auth/titles";

// Admin sign in / create account (local login — stand-in for TideCloak while its licence is unavailable).
export default function LoginPage() {
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("mode") === "signup") setTab("signup");
    // Already signed in? Go straight to the console.
    fetch("/api/auth/me").then((r) => { if (r.ok) window.location.href = "/console"; }).catch(() => {});
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(tab === "signin" ? "/api/auth/login" : "/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tab === "signin" ? { email, password } : { name, title, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      window.location.href = "/console";
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <div className="app">
      <Backdrop />
      <Spotlight />
      <div className="auth-wrap">
        <a className="brand auth-brand" href="/">
          <span className="brand-mark"><Icon name="gate" size={18} /></span>
          <span className="brand-name">QuorumGate</span>
        </a>

        <form className="panel auth-card" onSubmit={submit}>
          <div className="auth-icon"><Icon name={tab === "signin" ? "key" : "users"} size={26} /></div>
          <h1 className="auth-title">{tab === "signin" ? "Welcome back" : "Create admin account"}</h1>
          <p className="auth-sub">
            {tab === "signin" ? "Sign in to the critical access console." : "The first two accounts become founding approvers."}
          </p>

          <div className="segmented full" role="tablist">
            <button type="button" role="tab" aria-selected={tab === "signin"} className={tab === "signin" ? "on" : ""} onClick={() => { setTab("signin"); setError(null); }}>Sign in</button>
            <button type="button" role="tab" aria-selected={tab === "signup"} className={tab === "signup" ? "on" : ""} onClick={() => { setTab("signup"); setError(null); }}>Create account</button>
          </div>

          <div className="fields">
            {tab === "signup" && (
              <>
                <input className="field" placeholder="Full name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required />
                <div className="select-wrap">
                  <select className={`field select ${title ? "" : "placeholder"}`} value={title} onChange={(e) => setTitle(e.target.value)} required aria-label="Job title">
                    <option value="" disabled>Select your job title</option>
                    {JOB_TITLE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <span className="select-chevron" aria-hidden="true">⌄</span>
                </div>
              </>
            )}
            <input className="field" type="email" placeholder="Work email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <input className="field" type="password" placeholder={tab === "signup" ? "Password (8+ characters)" : "Password"} autoComplete={tab === "signin" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={tab === "signup" ? 8 : undefined} />
          </div>

          {error && <div className="auth-error"><Icon name="alert" size={15} /> {error}</div>}

          <button className="btn primary lg auth-submit" disabled={busy}>
            {busy ? "Please wait…" : tab === "signin" ? "Sign in" : "Create account"}
          </button>

          {tab === "signin" && (
            <div className="demo-box">
              <div className="demo-head">Demo admin accounts <span className="pill tiny orange">prototype</span></div>
              {DEMO_LOGINS.map((d) => (
                <button type="button" key={d.email} className="demo-login" onClick={() => { setEmail(d.email); setPassword(DEMO_PASSWORD); setError(null); }}>
                  <span className="me-avatar">{d.name.split(" ").map((w) => w[0]).join("")}</span>
                  <span className="demo-text">
                    <span className="demo-name">{d.name} · {d.title}</span>
                    <span className="demo-cred mono">{d.email}</span>
                  </span>
                  <span className="demo-use">Use</span>
                </button>
              ))}
              <div className="demo-pass">Password for both: <code>{DEMO_PASSWORD}</code></div>
            </div>
          )}

          <div className="auth-foot">
            <Icon name="lock" size={13} /> Passwords are salted and hashed (scrypt). In production this login is replaced by TideCloak, where no server holds your password at all.
          </div>
        </form>
      </div>
    </div>
  );
}
