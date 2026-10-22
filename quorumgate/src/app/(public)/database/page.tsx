"use client";

import { useCallback } from "react";
import { AdminNav } from "@/components/AdminNav";
import { DatabaseView } from "@/components/DatabaseView";

// Database viewer for admins signed in with the LOCAL login.
export default function DatabasePage() {
  const fetcher = useCallback((url: string, init?: RequestInit) => fetch(url, init), []);
  const toLogin = useCallback(() => { window.location.href = "/login"; }, []);
  return <DatabaseView fetcher={fetcher} consoleHref="/console" onUnauthorized={toLogin} nav={<AdminNav active="database" />} />;
}
