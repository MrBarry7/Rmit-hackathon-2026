import { approveTicket, createTicket, denyTicket, QuorumError, snapshot } from "@/lib/quorum/engine";
import { persist, state, withApprover } from "@/lib/quorum/serverStore";
import type { OperationId } from "@/lib/quorum/types";

// Quorum ticket API. Every call is authenticated (TideCloak JWT + DPoP, or a local session) and
// requires the approver role. The four-eyes rule is enforced in the engine on the caller's
// server-side identity, never on anything the browser claims.

export const GET = withApprover(async (_req, caller) => {
  return Response.json({ ...snapshot(state()), me: caller });
});

export const POST = withApprover(async (req, caller) => {
  let body: { action?: string; op?: OperationId; reason?: string; id?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const s = state();
  try {
    let ticket;
    switch (body.action) {
      case "create":
        ticket = await createTicket(s, caller, body.op as OperationId, String(body.reason ?? ""));
        break;
      case "approve":
        ticket = approveTicket(s, caller, String(body.id));
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
