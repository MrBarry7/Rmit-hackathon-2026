"use client";

import { TideCloakProvider } from "@tidecloak/nextjs";
import { useEffect, useState } from "react";

// Playbook: add-auth-nextjs-fresh Step 4a
// useDPoP goes inside config object (not as a separate JSX prop).
// Enables client-side DPoP proof generation (required for secureFetch).
//
// The adapter config (data/tidecloak.json, written by `npm run init`) is loaded at runtime from
// /api/config instead of a static import, so the rest of the app — landing page and /simulation —
// still builds and runs before TideCloak has been bootstrapped.
export function Providers({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/config")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "TideCloak config unavailable");
        setConfig(data);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  if (error) {
    return (
      <div className="center-page">
        <div className="card narrow">
          <div className="eyebrow">Live mode unavailable</div>
          <h2>TideCloak is not set up yet</h2>
          <p className="muted">
            The live console needs a licensed TideCloak realm. Run <code>npm run init</code> (see README), then reload.
          </p>
          <p className="muted small">Detail: {error}</p>
          <a className="btn" href="/simulation">Open the simulation instead</a>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="center-page">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <TideCloakProvider config={{ ...config, useDPoP: { mode: "strict", alg: "ES256" } } as never}>
      {children}
    </TideCloakProvider>
  );
}
