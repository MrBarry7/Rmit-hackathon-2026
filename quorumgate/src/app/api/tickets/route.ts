import { approveTicket, createTicket, denyTicket, QuorumError, snapshot } from "@/lib/quorum/engine";
import { persist, state, withApprover } from "@/lib/quorum/serverStore";
import { db } from "@/lib/db";
import type { OperationId } from "@/lib/quorum/types";

// Quorum ticket API. Every call is authenticated (TideCloak JWT + DPoP, or a local session) and
// requires the approver role. The four-eyes rule is enforced in the engine on the caller's
// server-side identity, never on anything the browser claims.

export const GET = withApprover(async (_req, caller) => {
  return Response.json({ ...snapshot(state()), me: caller });
});

export const POST = withApprover(async (req, caller) => {
  let body: { action?: string; op?: OperationId; reason?: string; id?: string; targetId?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const s = state();
  try {
    let ticket;
    switch (body.action) {
      case "create": {
        let target: { sub: string; name: string } | undefined;
        if (body.op === "ADMIT_ADMIN") {
          // The target must be a real, still-pending account in the database.
          const u = db().prepare("SELECT id, name, role FROM users WHERE id = ?").get(String(body.targetId ?? "")) as
            | { id: string; name: string; role: string } | undefined;
          if (!u) return Response.json({ error: "Account not found" }, { status: 404 });
          if (u.role !== "pending") return Response.json({ error: `${u.name} is already an approver` }, { status: 409 });
          target = { sub: u.id, name: u.name };
        }
        ticket = await createTicket(s, caller, body.op as OperationId, String(body.reason ?? ""), target);
        break;
      }
      case "approve":
        ticket = approveTicket(s, caller, String(body.id));
        // Side effect of a GRANTED admission: the pending account becomes an approver.
        // Only reachable after two distinct approvers have signed (enforced in the engine).
        if (ticket.op === "ADMIT_ADMIN" && ticket.status === "GRANTED" && ticket.target) {
          db().prepare("UPDATE users SET role = 'approver' WHERE id = ? AND role = 'pending'").run(ticket.target.sub);
        }
        break;
      case "deny":
        ticket = denyTicket(s, caller, String(body.id));
        break;
      default:
        return Response.json({ error: "Unknown action" }, { status: 400 });
    }
    persist();
    return Response.json({ ticket });
  } catch (err) {
    persist(); // refused attempts are audited too
    if (err instanceof QuorumError) return Response.json({ error: err.message }, { status: err.status });
    throw err;
  }
});
