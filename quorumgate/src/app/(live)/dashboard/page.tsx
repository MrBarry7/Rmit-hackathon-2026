"use client";

import { useTideCloak } from "@tidecloak/nextjs";
import { useMemo } from "react";
import { QuorumConsole } from "@/components/QuorumConsole";
import { Icon } from "@/components/Icon";
import { liveApi } from "@/lib/quorum/clientApi";

// LIVE console. The identity shown here comes from the TideCloak session; every API call carries
// the DPoP-bound token, and the server re-verifies it. hasRealmRole() below only picks what to
// render — the API enforces the real `quorum-approver` check.
export default function DashboardPage() {
  const { secureFetch, logout, hasRealmRole, getValueFromIdToken } = useTideCloak();

  // secureFetch attaches `Authorization: DPoP <token>` plus a fresh DPoP proof signed by this
  // device's key for this exact URL + method. The server rejects plain Bearer replays.
  const api = useMemo(() => liveApi((url, init) => secureFetch(url, init)), [secureFetch]);

  const username = String(getValueFromIdToken("preferred_username") ?? "");
  const title = username === "auditor" ? "Security Auditor" : username === "admin" ? "Operations Admin" : "Administrator";

  if (!hasRealmRole("quorum-approver")) {
    return (
      <div className="center-page">
        <div className="card narrow">
          <span className="tile green"><Icon name="check" size={18} /></span>
          <div className="eyebrow">Signed in with TideCloak</div>
          <h2>Welcome{username ? `, ${username.slice(0, 12)}` : ""}</h2>
          <p className="muted">
            Your Tide account is ready, but you are not an approver yet. In QuorumGate even that is protected: an
            existing admin can propose giving you the <code>quorum-approver</code> role, and TideCloak holds it as a
            change request until the realm&apos;s admin quorum approves it. Nobody can quietly add a sock-puppet approver.
          </p>
          <button className="btn tinted" onClick={logout}><Icon name="logout" size={16} /> Sign out</button>
        </div>
      </div>
    );
  }

  return (
    <QuorumConsole
      api={api}
      title={title}
      headerRight={
        <button className="icon-btn" onClick={logout} title="Sign out" aria-label="Sign out">
          <Icon name="logout" size={16} />
        </button>
      }
    />
  );
}
