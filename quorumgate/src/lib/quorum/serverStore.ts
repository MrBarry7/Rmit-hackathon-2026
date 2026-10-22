import type { NextRequest } from "next/server";
import type { JWTPayload } from "jose";
import { withRole } from "../auth/protect";
import { callerFromUser, withSession } from "../auth/local";
import { loadEngineState, saveEngineState } from "../db";
import type { Caller, EngineState } from "./engine";

// Engine state is loaded from SQLite (data/quorumgate.db) on first use, kept in memory, and written
// back after every mutation via persist().

const g = globalThis as unknown as { __quorumState?: EngineState };

export function state(): EngineState {
  return (g.__quorumState ??= loadEngineState());
}

export function persist() {
  saveEngineState(state());
}

export function callerFromJwt(jwt: JWTPayload): Caller {
  const p = jwt as JWTPayload & { preferred_username?: string; given_name?: string; family_name?: string; cnf?: { jkt?: string } };
  const full = [p.given_name, p.family_name].filter(Boolean).join(" ");
  return { sub: String(p.sub), name: full || p.preferred_username || String(p.sub).slice(0, 8), keyThumbprint: p.cnf?.jkt ?? "unbound" };
}

/**
 * Authenticates an approver by EITHER login method and hands the handler a Caller:
 *  - `Authorization: DPoP …` → TideCloak: JWT + DPoP proof verified, `quorum-approver` role required.
 *  - otherwise              → local session cookie (stand-in while the Tide licence is unavailable).
 */
export function withApprover(handler: (req: Request, caller: Caller) => Promise<Response> | Response) {
  const tide = withRole("quorum-approver", async (req, jwt) => handler(req, callerFromJwt(jwt)));
  const local = withSession((req, user) => handler(req, callerFromUser(user)), { approverOnly: true });
  return (req: NextRequest) => (req.headers.get("authorization") ? tide(req) : local(req));
}
