"use client";

import { useTideCloak } from "@tidecloak/nextjs";
import { useCallback, useMemo } from "react";
import { AdminNav } from "@/components/AdminNav";
import { DatabaseView } from "@/components/DatabaseView";

// Database viewer for admins signed in with TideCloak (calls carry the DPoP-bound token).
export default function TideDatabasePage() {
  const { secureFetch, logout } = useTideCloak();
  const fetcher = useMemo(() => (url: string, init?: RequestInit) => secureFetch(url, init), [secureFetch]);
  const relogin = useCallback(() => { window.location.href = "/dashboard"; }, []);
  return (
    <DatabaseView
      fetcher={fetcher}
      consoleHref="/dashboard"
      onUnauthorized={relogin}
      nav={<AdminNav active="database" consoleHref="/dashboard" databaseHref="/dashboard/database" fetcher={fetcher} onLogout={logout} />}
    />
  );
}
