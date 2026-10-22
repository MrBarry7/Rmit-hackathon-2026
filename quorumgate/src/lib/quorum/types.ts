// Shared types for QuorumGate tickets, used by both the server store and the UI.

export type OperationId = "UNMASK_LEDGER" | "GRANT_ROOT";

export interface OperationDef {
  id: OperationId;
  label: string;
  risk: "CRITICAL" | "HIGH";
  description: string;
}

export const OPERATIONS: Record<OperationId, OperationDef> = {
  UNMASK_LEDGER: {
    id: "UNMASK_LEDGER",
    label: "Decrypt customer PII & financial ledger",
    risk: "CRITICAL",
    description:
      "Reveals full names, national IDs, card numbers and balances for every customer in the ledger.",
  },
  GRANT_ROOT: {
    id: "GRANT_ROOT",
    label: "Grant elevated (root) privileges",
    risk: "HIGH",
    description:
      "Gives an operator unrestricted production access for a time-boxed maintenance window.",
  },
};

export interface Signature {
  sub: string; // Tide-verified subject (the user's vuid-backed id) — cannot be forged by the app
  name: string;
  at: string; // ISO time
  keyThumbprint: string; // DPoP key (cnf.jkt) the approving session is bound to
  role: "REQUESTER" | "APPROVER";
}

export type TicketStatus = "PENDING" | "GRANTED" | "DENIED" | "EXPIRED";

export interface Ticket {
  id: string;
  hash: string; // sha256 over the immutable request content
  op: OperationId;
  reason: string;
  requester: { sub: string; name: string };
  createdAt: string;
  status: TicketStatus;
  threshold: number;
  signatures: Signature[];
  deniedBy?: { sub: string; name: string; at: string };
  grantedAt?: string;
  expiresAt?: string; // access window after quorum is reached
}

export interface AuditEvent {
  at: string;
  actor: string;
  kind: "BLOCKED" | "REQUESTED" | "SIGNED" | "GRANTED" | "DENIED" | "ACCESSED" | "REJECTED";
  detail: string;
  ticketId?: string;
}

export interface CustomerRecord {
  id: string;
  name: string;
  nationalId: string;
  card: string;
  balance: string;
  risk: "LOW" | "MEDIUM" | "HIGH";
}

export interface Identity {
  sub: string;
  name: string;
  title: string;
}
