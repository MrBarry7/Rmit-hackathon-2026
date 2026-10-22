import { persist, state, withAdmin } from "@/lib/quorum/serverStore";

// DEMO ONLY: wipes all tickets, signatures and the audit log so the walkthrough can be repeated.
// Admin accounts are kept. In a real deployment this endpoint must not exist — a single admin
// erasing the audit trail is exactly the kind of unilateral power QuorumGate removes.
// Disable it by setting DEMO_RESET=off in .env.
export const POST = withAdmin(() => {
  if (process.env.DEMO_RESET === "off") return Response.json({ error: "Demo reset is disabled" }, { status: 404 });
  const s = state();
  s.tickets.length = 0;
  s.audit.length = 0;
  persist();
  return Response.json({ ok: true });
}, { approverOnly: true });
