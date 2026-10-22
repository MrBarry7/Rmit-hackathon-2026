import { withRole } from "@/lib/auth/protect";
import { activeGrant, logAccess, recordUnilateralAttempt } from "@/lib/quorum/engine";
import { LEDGER, maskedLedger } from "@/lib/quorum/records";
import { callerFromJwt, serverState } from "@/lib/quorum/serverStore";

// REAL server-side enforcement. withRole() has already verified the TideCloak JWT against the
// realm's embedded JWKS, checked the DPoP proof, and required the `quorum-approver` role.
// Even then, plaintext is released ONLY if a quorum ticket for this exact caller is GRANTED.
// Hiding a button in the UI would not be authorization; this check is.
export const GET = withRole("quorum-approver", async (req, jwt) => {
  const caller = callerFromJwt(jwt);
  const grant = activeGrant(serverState, caller.sub, "UNMASK_LEDGER");

  if (grant) {
    logAccess(serverState, caller, grant);
    return Response.json({ masked: false, records: LEDGER, grant: { id: grant.id, expiresAt: grant.expiresAt } });
  }

  // `?unilateral=1` is the "rogue admin" path: the admin tries to pull plaintext directly.
  if (new URL(req.url).searchParams.get("unilateral") === "1") {
    recordUnilateralAttempt(serverState, caller, "UNMASK_LEDGER");
    return Response.json(
      { error: "UNILATERAL ATTEMPT BLOCKED — quorum approval required", masked: true, records: maskedLedger() },
      { status: 403 }
    );
  }

  return Response.json({ masked: true, records: maskedLedger() });
});
