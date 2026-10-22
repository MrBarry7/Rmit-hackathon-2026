import type { NextRequest } from "next/server";
import type { JWTPayload } from "jose";
import { withAuth } from "../auth/protect";
import { callerFromUser, readSessionCookie, userFromSession, type LocalUser } from "../auth/local";
import { db, loadEngineState, saveEngineState } from "../db";
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

const TIDE_MARKER = "tidecloak"; // stored instead of a password hash: Tide accounts have no password here
const TIDE_FOUNDING_APPROVERS = 2;

/**
 * A TideCloak-verified identity becomes a row in our `users` table (keyed by the token's `sub`).
 * The first two Tide identities are the founding approvers; later ones start as `pending` and
 * need an ADMIT_ADMIN ticket co-signed by two approvers. The identity itself is proven by
 * TideCloak — this app never sees or stores a Tide password.
 */
export function tideUser(jwt: JWTPayload): LocalUser {
  const d = db();
  const c = callerFromJwt(jwt);
  const p = jwt as JWTPayload & { email?: string; preferred_username?: string };
  const existing = d.prepare("SELECT id, email, name, title, role, created_at FROM users WHERE id = ?").get(c.sub) as LocalUser | undefined;
  if (existing) return existing;
  const tideCount = (d.prepare("SELECT COUNT(*) AS n FROM users WHERE password_hash = ?").get(TIDE_MARKER) as { n: number }).n;
  const user: LocalUser = {
    id: c.sub,
    email: p.email || `${p.preferred_username ?? c.sub.slice(0, 8)}@tide`,
    name: c.name,
    title: tideCount === 0 ? "Operations Admin" : tideCount === 1 ? "Security Auditor" : "Administrator",
    role: tideCount < TIDE_FOUNDING_APPROVERS ? "approver" : "pending",
    created_at: new Date().toISOString(),
  };
  d.prepare("INSERT INTO users (id, email, name, title, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(user.id, user.email, user.name, user.title, TIDE_MARKER, user.role, user.created_at);
  return user;
}

export interface Admin {
  user: LocalUser;
  caller: Caller;
  via: "tidecloak" | "local";
}

/**
 * Authenticates an admin by EITHER login method:
 *  - `Authorization: DPoP …` → TideCloak: JWT signature + DPoP proof verified server-side.
 *  - otherwise              → local session cookie (stand-in when TideCloak isn't available).
 * `approverOnly` additionally requires the approver role (pending accounts get 403).
 */
export function withAdmin(
  handler: (req: Request, admin: Admin) => Promise<Response> | Response,
  opts: { approverOnly?: boolean } = {}
) {
  const gate = (req: Request, admin: Admin) =>
    opts.approverOnly && admin.user.role !== "approver"
      ? Response.json({ error: "Your account is waiting to be admitted as an approver", pending: true }, { status: 403 })
      : handler(req, admin);

  const tide = withAuth(async (req, jwt) => {
    const user = tideUser(jwt);
    // Use the stored record (role/title can change after admission) but the token's key binding.
    return gate(req, { user, caller: { ...callerFromJwt(jwt), name: user.name }, via: "tidecloak" });
  });

  return async (req: NextRequest) => {
    if (req.headers.get("authorization")) return tide(req);
    const u = userFromSession(readSessionCookie(req));
    if (!u) return Response.json({ error: "Please sign in" }, { status: 401 });
    const { sessionId: _s, ...user } = u;
    void _s;
    return gate(req, { user, caller: callerFromUser(u), via: "local" });
  };
}

/** Approver-only shorthand used by the ledger and ticket APIs. */
export function withApprover(handler: (req: Request, caller: Caller) => Promise<Response> | Response) {
  return withAdmin((req, a) => handler(req, a.caller), { approverOnly: true });
}
