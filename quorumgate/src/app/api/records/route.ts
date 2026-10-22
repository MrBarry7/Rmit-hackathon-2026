import { activeGrant, logAccess, recordUnilateralAttempt } from "@/lib/quorum/engine";
import { maskedLedger, LEDGER } from "@/lib/quorum/records";
import { persist, state, withApprover } from "@/lib/quorum/serverStore";

// REAL server-side enforcement. withApprover() has already authenticated the caller (TideCloak
// token + DPoP proof, or a local session) and required the approver role. Even then, plaintext is
// released ONLY if a quorum ticket for this exact caller is GRANTED. Hiding a button in the UI
// would not be authorization; this check is.
export const GET = withApprover(async (req, caller) => {
  const s = state();
  const grant = activeGrant(s, caller.sub, "UNMASK_LEDGER");

  if (grant) {
    logAccess(s, caller, grant);
    persist();
    return Response.json({ masked: false, records: LEDGER, grant: { id: grant.id, expiresAt: grant.expiresAt } });
  }

  // `?unilateral=1` is the "rogue admin" path: the admin tries to pull plaintext directly.
  if (new URL(req.url).searchParams.get("unilateral") === "1") {
    recordUnilateralAttempt(s, caller, "UNMASK_LEDGER");
    persist();
    return Response.json(
      { error: "UNILATERAL ATTEMPT BLOCKED — quorum approval required", masked: true, records: maskedLedger() },
      { status: 403 }
    );
  }

  return Response.json({ masked: true, records: maskedLedger() });
});
