import { db } from "@/lib/db";
import { activeGrant } from "@/lib/quorum/engine";
import { maskedLedger } from "@/lib/quorum/records";
import { state, withAdmin } from "@/lib/quorum/serverStore";

// Read-only database viewer for signed-in APPROVERS (pending accounts get 403). Password hashes and session ids are NEVER
// returned. The customers table is masked unless this admin holds a GRANTED quorum ticket —
// the database view obeys the same rule as the ledger API.
export const GET = withAdmin((_req, { user, caller }) => {
  const d = db();
  const users = d.prepare("SELECT id, email, name, title, role, created_at FROM users ORDER BY created_at").all();
  const tickets = d.prepare("SELECT id, op, status, requester_name, target_id, target_name, threshold, hash, reason, created_at, granted_at, expires_at FROM tickets ORDER BY created_at DESC").all();
  const signatures = d.prepare("SELECT ticket_id, name, role, signed_at, key_thumbprint FROM signatures ORDER BY signed_at DESC").all();
  const audit = d.prepare("SELECT id, at, actor, kind, detail, ticket_id FROM audit ORDER BY id DESC LIMIT 200").all();
  const granted = user.role === "approver" && !!activeGrant(state(), caller.sub, "UNMASK_LEDGER");
  const customers = granted
    ? d.prepare("SELECT id, name, national_id, card, balance, risk FROM customers ORDER BY id").all()
    : maskedLedger().map((c) => ({ id: c.id, name: c.name, national_id: c.nationalId, card: c.card, balance: c.balance, risk: c.risk }));
  return Response.json({ users, tickets, signatures, audit, customers, customersMasked: !granted, file: "data/quorumgate.db" });
}, { approverOnly: true });
