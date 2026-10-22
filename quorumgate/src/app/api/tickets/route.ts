import { withRole } from "@/lib/auth/protect";
import { approveTicket, createTicket, denyTicket, QuorumError, snapshot } from "@/lib/quorum/engine";
import { callerFromJwt, serverState } from "@/lib/quorum/serverStore";
import type { OperationId } from "@/lib/quorum/types";

// Quorum ticket API. Every call is authenticated by TideCloak (JWT + DPoP) and requires the
// `quorum-approver` realm role. Who holds that role is itself governed by TideCloak IGA:
// granting it to a new person creates a change request that other admins must approve, so a
// rogue admin cannot mint a sock-puppet approver.

export const GET = withRole("quorum-approver", async (_req, jwt) => {
  return Response.json({ ...snapshot(serverState), me: callerFromJwt(jwt) });
});

export const POST = withRole("quorum-approver", async (req, jwt) => {
  const caller = callerFromJwt(jwt);
  let body: { action?: string; op?: OperationId; reason?: string; id?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    switch (body.action) {
      case "create":
        return Response.json({ ticket: await createTicket(serverState, caller, body.op as OperationId, String(body.reason ?? "")) });
      case "approve":
        return Response.json({ ticket: approveTicket(serverState, caller, String(body.id)) });
      case "deny":
        return Response.json({ ticket: denyTicket(serverState, caller, String(body.id)) });
      default:
        return Response.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err) {
    if (err instanceof QuorumError) return Response.json({ error: err.message }, { status: err.status });
    throw err;
  }
});
