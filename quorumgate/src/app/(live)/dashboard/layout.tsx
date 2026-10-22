"use client";

import { useTideCloak } from "@tidecloak/nextjs";
import { useEffect } from "react";

// Playbook: protect-routes-nextjs
// This is UI gating only — NOT real authorization.
// Real authorization happens in API routes via JWT + DPoP verification.
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { authenticated, isInitializing, login } = useTideCloak();

  useEffect(() => {
    if (!isInitializing && !authenticated) {
      login();
    }
  }, [isInitializing, authenticated, login]);

  if (isInitializing || !authenticated) {
    return (
      <div className="center-page">
        <div className="spinner" />
        <p className="muted">Verifying your identity with TideCloak…</p>
      </div>
    );
  }

  return <>{children}</>;
}
