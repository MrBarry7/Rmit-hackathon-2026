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
  const title = username === "auditor" ? "Admin 2 · Security Auditor" : username === "admin" ? "Admin 1 · Operations Admin" : "Administrator";

  if (!hasRealmRole("quorum-approver")) {
    return (
      <div className="center-page">
        <div className="card narrow">
          <h2>Not a quorum approver</h2>
          <p className="muted">
            You are signed in with TideCloak, but your account does not hold the <code>quorum-approver</code> role.
            Granting it is an IGA-governed change: existing admins must approve it in TideCloak.
          </p>
          <button className="btn" onClick={logout}><Icon name="logout" size={16} /> Sign out</button>
        </div>
      </div>
    );
  }

  return (
    <QuorumConsole
      api={api}
      title={title}
      headerRight={
        <button className="btn ghost" onClick={logout} title="Sign out">
          <Icon name="logout" size={16} />
        </button>
      }
    />
  );
}
