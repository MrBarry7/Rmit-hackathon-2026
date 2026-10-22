import { OPERATIONS, type AuditEvent, type OperationId, type Ticket } from "./types";

// The quorum rules, in one place. The SAME engine runs:
//   - on the server (src/lib/quorum/serverStore.ts) in live mode, where every caller identity
//     comes from a TideCloak JWT + DPoP proof that the server has verified, and
//   - in the browser in /simulation, where the identities are MOCKED (clearly labelled there).
// Keeping one engine means the simulation cannot drift from the rules the server enforces.

export const THRESHOLD = 2; // signatures required: requester + one independent approver
export const ACCESS_WINDOW_MIN = 10; // how long a granted unmask stays valid

export class QuorumError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export interface Caller {
  sub: string;
  name: string;
  keyThumbprint: string;
}

export interface EngineState {
  tickets: Ticket[];
  audit: AuditEvent[];
}

export function newState(): EngineState {
  return { tickets: [], audit: [] };
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

function log(state: EngineState, e: Omit<AuditEvent, "at">) {
  state.audit.unshift({ at: new Date().toISOString(), ...e });
  state.audit.splice(200);
}

function expire(state: EngineState) {
  const now = Date.now();
  for (const t of state.tickets) {
    if (t.status === "GRANTED" && t.expiresAt && Date.parse(t.expiresAt) < now) t.status = "EXPIRED";
  }
}

/** A direct, unilateral attempt. Always refused — this is the "God Mode" QuorumGate removes. */
export function recordUnilateralAttempt(state: EngineState, caller: Caller, op: OperationId) {
  log(state, {
    actor: caller.name,
    kind: "BLOCKED",
    detail: `Unilateral attempt: "${OPERATIONS[op].label}" refused — quorum ${THRESHOLD}/${THRESHOLD} required`,
  });
}

export async function createTicket(
  state: EngineState,
  caller: Caller,
  op: OperationId,
  reason: string
): Promise<Ticket> {
  if (!OPERATIONS[op]) throw new QuorumError("Unknown operation", 400);
  const cleanReason = reason.trim().slice(0, 280);
  if (cleanReason.length < 8) throw new QuorumError("A business justification (8+ characters) is required", 400);
  if (state.tickets.some((t) => t.status === "PENDING" && t.op === op && t.requester.sub === caller.sub)) {
    throw new QuorumError("You already have a pending request for this operation", 409);
  }

  const createdAt = new Date().toISOString();
  const id = `QG-${Math.random().toString(36).slice(2, 6).toUpperCase()}${Date.now().toString(36).slice(-3).toUpperCase()}`;
  const hash = await sha256Hex(JSON.stringify({ id, op, reason: cleanReason, requester: caller.sub, createdAt }));

  const ticket: Ticket = {
    id,
    hash,
    op,
    reason: cleanReason,
    requester: { sub: caller.sub, name: caller.name },
    createdAt,
    status: "PENDING",
    threshold: THRESHOLD,
    signatures: [
      { sub: caller.sub, name: caller.name, at: createdAt, keyThumbprint: caller.keyThumbprint, role: "REQUESTER" },
    ],
  };
  state.tickets.unshift(ticket);
  recordUnilateralAttempt(state, caller, op);
  log(state, { actor: caller.name, kind: "REQUESTED", detail: `Opened quorum ticket (1/${THRESHOLD} signatures)`, ticketId: id });
  return ticket;
}

export function approveTicket(state: EngineState, caller: Caller, id: string): Ticket {
  expire(state);
  const t = state.tickets.find((x) => x.id === id);
  if (!t) throw new QuorumError("Ticket not found", 404);
  if (t.status !== "PENDING") throw new QuorumError(`Ticket is ${t.status}`, 409);

  // Four-eyes rule. Identity is the Tide-verified `sub`, not a name or a UI toggle:
  // the same human cannot sign twice, and the requester cannot approve their own request.
  if (t.requester.sub === caller.sub || t.signatures.some((s) => s.sub === caller.sub)) {
    log(state, { actor: caller.name, kind: "REJECTED", detail: "Self-approval refused (four-eyes rule)", ticketId: id });
    throw new QuorumError("Self-approval refused: a different, independently authenticated admin must sign", 403);
  }

  t.signatures.push({ sub: caller.sub, name: caller.name, at: new Date().toISOString(), keyThumbprint: caller.keyThumbprint, role: "APPROVER" });
  log(state, { actor: caller.name, kind: "SIGNED", detail: `Co-signed (${t.signatures.length}/${t.threshold})`, ticketId: id });

  if (t.signatures.length >= t.threshold) {
    t.status = "GRANTED";
    t.grantedAt = new Date().toISOString();
    t.expiresAt = new Date(Date.now() + ACCESS_WINDOW_MIN * 60_000).toISOString();
    log(state, { actor: "QuorumGate", kind: "GRANTED", detail: `Quorum reached — access window ${ACCESS_WINDOW_MIN} min for ${t.requester.name}`, ticketId: id });
  }
  return t;
}

export function denyTicket(state: EngineState, caller: Caller, id: string): Ticket {
  const t = state.tickets.find((x) => x.id === id);
  if (!t) throw new QuorumError("Ticket not found", 404);
  if (t.status !== "PENDING") throw new QuorumError(`Ticket is ${t.status}`, 409);
  t.status = "DENIED";
  t.deniedBy = { sub: caller.sub, name: caller.name, at: new Date().toISOString() };
  log(state, { actor: caller.name, kind: "DENIED", detail: "Request denied", ticketId: id });
  return t;
}

/** Returns the GRANTED, unexpired ticket that lets this caller see the unmasked ledger, if any. */
export function activeGrant(state: EngineState, callerSub: string, op: OperationId): Ticket | undefined {
  expire(state);
  return state.tickets.find((t) => t.status === "GRANTED" && t.op === op && t.requester.sub === callerSub);
}

export function logAccess(state: EngineState, caller: Caller, t: Ticket) {
  log(state, { actor: caller.name, kind: "ACCESSED", detail: "Viewed unmasked ledger under quorum grant", ticketId: t.id });
}

export function snapshot(state: EngineState) {
  expire(state);
  return { tickets: state.tickets, audit: state.audit, threshold: THRESHOLD };
}
