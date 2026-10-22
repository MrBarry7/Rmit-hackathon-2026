import type { JWTPayload } from "jose";
import { newState, type Caller, type EngineState } from "./engine";

// PROTOTYPE LIMITATION (stated in README/summary): tickets live in server memory and reset when
// the dev server restarts. Production would persist them to a database. What is NOT simulated:
// every caller below is derived from a TideCloak token the server has verified (signature against
// the realm's embedded JWKS + DPoP proof of possession) before any engine function runs.

const g = globalThis as unknown as { __quorumState?: EngineState };
export const serverState: EngineState = (g.__quorumState ??= newState());

export function callerFromJwt(jwt: JWTPayload): Caller {
  const p = jwt as JWTPayload & {
    preferred_username?: string;
    given_name?: string;
    family_name?: string;
    cnf?: { jkt?: string };
  };
  const full = [p.given_name, p.family_name].filter(Boolean).join(" ");
  return {
    sub: String(p.sub),
    name: full || p.preferred_username || String(p.sub).slice(0, 8),
    keyThumbprint: p.cnf?.jkt ?? "unbound",
  };
}
