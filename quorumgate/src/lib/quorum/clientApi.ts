import {
  approveTicket,
  activeGrant,
  createTicket,
  denyTicket,
  logAccess,
  newState,
  QuorumError,
  recordUnilateralAttempt,
  snapshot,
  type Caller,
} from "./engine";
import { LEDGER, maskedLedger } from "./records";
import type { AuditEvent, CustomerRecord, Identity, OperationId, Ticket } from "./types";

export interface Snapshot {
  tickets: Ticket[];
  audit: AuditEvent[];
  threshold: number;
  me: { sub: string; name: string; keyThumbprint: string };
}

export interface RecordsResult {
  masked: boolean;
  records: CustomerRecord[];
  blocked?: string;
  grant?: { id: string; expiresAt?: string };
}

export interface ConsoleApi {
  mode: "live" | "simulation";
  load(): Promise<Snapshot>;
  records(unilateral?: boolean): Promise<RecordsResult>;
  create(op: OperationId, reason: string): Promise<void>;
  approve(id: string): Promise<void>;
  deny(id: string): Promise<void>;
}

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

async function readJson(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok && res.status !== 403) throw new Error(data.error || `${res.status} ${res.statusText}`);
  if (res.status === 403 && !("records" in data)) throw new Error(data.error || "Forbidden");
  return data;
}

// ---------------------------------------------------------------------------------------------
// LIVE: every call goes to this app's API with a DPoP-bound TideCloak token. The server verifies
// the token + proof and enforces the quorum. Nothing here is trusted by the server.
// ---------------------------------------------------------------------------------------------
export function liveApi(fetcher: Fetcher): ConsoleApi {
  const post = async (body: object) =>
    readJson(await fetcher("/api/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
  return {
    mode: "live",
    load: async () => readJson(await fetcher("/api/tickets")),
    records: async (unilateral) => {
      const res = await fetcher(`/api/records${unilateral ? "?unilateral=1" : ""}`);
      const data = await readJson(res);
      return { ...data, blocked: res.status === 403 ? data.error : undefined };
    },
    create: async (op, reason) => void (await post({ action: "create", op, reason })),
    approve: async (id) => void (await post({ action: "approve", id })),
    deny: async (id) => void (await post({ action: "deny", id })),
  };
}

// ---------------------------------------------------------------------------------------------
// SIMULATION (MOCKED): runs the SAME quorum engine in the browser with two fake identities so the
// flow can be demonstrated without TideCloak. The identities, key thumbprints and "signatures"
// here are NOT cryptographic — anyone could flip the persona switch. That is exactly the weakness
// the live mode removes by deriving identity from TideCloak-verified, DPoP-bound tokens.
// ---------------------------------------------------------------------------------------------
export const SIM_PERSONAS: (Identity & { keyThumbprint: string })[] = [
  { sub: "sim-0001-ops", name: "Aiman Hakim", title: "Admin 1 · Operations Admin", keyThumbprint: "SIMULATED-jkt-7f3a" },
  { sub: "sim-0002-sec", name: "Priya Nair", title: "Admin 2 · Security Auditor", keyThumbprint: "SIMULATED-jkt-c91e" },
];

export function simulationApi(getPersona: () => Caller): ConsoleApi {
  const state = newState();
  const wrap = async <T>(fn: () => T | Promise<T>) => {
    await new Promise((r) => setTimeout(r, 350)); // feel like a network round-trip
    try {
      return await fn();
    } catch (e) {
      if (e instanceof QuorumError) throw new Error(e.message);
      throw e;
    }
  };
  return {
    mode: "simulation",
    load: () => wrap(() => ({ ...snapshot(state), me: getPersona() })),
    records: (unilateral) =>
      wrap(() => {
        const me = getPersona();
        const grant = activeGrant(state, me.sub, "UNMASK_LEDGER");
        if (grant) {
          logAccess(state, me, grant);
          return { masked: false, records: LEDGER, grant: { id: grant.id, expiresAt: grant.expiresAt } };
        }
        if (unilateral) {
          recordUnilateralAttempt(state, me, "UNMASK_LEDGER");
          return { masked: true, records: maskedLedger(), blocked: "UNILATERAL ATTEMPT BLOCKED — quorum approval required" };
        }
        return { masked: true, records: maskedLedger() };
      }),
    create: (op, reason) => wrap(async () => void (await createTicket(state, getPersona(), op, reason))),
    approve: (id) => wrap(() => void approveTicket(state, getPersona(), id)),
    deny: (id) => wrap(() => void denyTicket(state, getPersona(), id)),
  };
}
