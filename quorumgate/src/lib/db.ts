import { DatabaseSync } from "node:sqlite";
import { randomBytes, randomUUID, scryptSync } from "crypto";
import { mkdirSync } from "fs";
import { join } from "path";
import { LEDGER } from "./quorum/records";
import type { AuditEvent, Ticket } from "./quorum/types";

// SQLite database (Node's built-in driver, no extra dependency). File: data/quorumgate.db
// Tables: users, sessions, tickets, signatures, audit, customers.

const g = globalThis as unknown as { __qgDb?: DatabaseSync };

export function db(): DatabaseSync {
  if (g.__qgDb) return g.__qgDb;
  const dir = join(process.cwd(), "data");
  mkdirSync(dir, { recursive: true });
  const d = new DatabaseSync(join(dir, "quorumgate.db"));
  d.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      title TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('approver', 'pending')),
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      op TEXT NOT NULL,
      reason TEXT NOT NULL,
      requester_id TEXT NOT NULL,
      requester_name TEXT NOT NULL,
      status TEXT NOT NULL,
      threshold INTEGER NOT NULL,
      hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      granted_at TEXT,
      expires_at TEXT,
      denied_by TEXT
    );
    CREATE TABLE IF NOT EXISTS signatures (
      ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      signed_at TEXT NOT NULL,
      key_thumbprint TEXT NOT NULL,
      PRIMARY KEY (ticket_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      at TEXT NOT NULL,
      actor TEXT NOT NULL,
      kind TEXT NOT NULL,
      detail TEXT NOT NULL,
      ticket_id TEXT
    );
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      national_id TEXT NOT NULL,
      card TEXT NOT NULL,
      balance TEXT NOT NULL,
      risk TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_signatures_ticket ON signatures(ticket_id);
  `);
  // Seed the fictional sample ledger once.
  const count = (d.prepare("SELECT COUNT(*) AS n FROM customers").get() as { n: number }).n;
  if (count === 0) {
    const ins = d.prepare("INSERT INTO customers (id, name, national_id, card, balance, risk) VALUES (?, ?, ?, ?, ?, ?)");
    for (const c of LEDGER) ins.run(c.id, c.name, c.nationalId, c.card, c.balance, c.risk);
  }
  seedDemoAdmins(d);
  g.__qgDb = d;
  return d;
}

// DEMO ACCOUNTS (prototype only): on a brand-new database, create the two founding approvers so the
// app can be tried straight away. Password comes from DEMO_ADMIN_PASSWORD in .env, else the
// documented demo default. Remove/override before any real use.
export const DEMO_PASSWORD_DEFAULT = "QuorumGate2026!";
export const DEMO_ADMINS = [
  { email: "ops.admin@quorumgate.demo", name: "Aiman Hakim", title: "Operations Admin" },
  { email: "security.auditor@quorumgate.demo", name: "Priya Nair", title: "Security Auditor" },
];

function seedDemoAdmins(d: DatabaseSync) {
  const n = (d.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n;
  if (n > 0) return;
  const password = process.env.DEMO_ADMIN_PASSWORD || DEMO_PASSWORD_DEFAULT;
  const ins = d.prepare("INSERT INTO users (id, email, name, title, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, 'approver', ?)");
  for (const a of DEMO_ADMINS) {
    const salt = randomBytes(16);
    const hash = `scrypt$${salt.toString("hex")}$${scryptSync(password, salt, 64).toString("hex")}`;
    ins.run(randomUUID(), a.email, a.name, a.title, hash, new Date().toISOString());
  }
}

type Row = Record<string, unknown>;

export function loadEngineState(): { tickets: Ticket[]; audit: AuditEvent[] } {
  const d = db();
  const sigs = d.prepare("SELECT * FROM signatures ORDER BY signed_at").all() as Row[];
  const tickets = (d.prepare("SELECT * FROM tickets ORDER BY created_at DESC").all() as Row[]).map((t) => {
    const denied = t.denied_by ? JSON.parse(String(t.denied_by)) : undefined;
    return {
      id: String(t.id),
      op: t.op,
      reason: String(t.reason),
      requester: { sub: String(t.requester_id), name: String(t.requester_name) },
      status: t.status,
      threshold: Number(t.threshold),
      hash: String(t.hash),
      createdAt: String(t.created_at),
      grantedAt: (t.granted_at as string) ?? undefined,
      expiresAt: (t.expires_at as string) ?? undefined,
      deniedBy: denied,
      signatures: sigs
        .filter((s) => s.ticket_id === t.id)
        .map((s) => ({ sub: String(s.user_id), name: String(s.name), role: s.role, at: String(s.signed_at), keyThumbprint: String(s.key_thumbprint) })),
    } as Ticket;
  });
  const audit = (d.prepare("SELECT * FROM audit ORDER BY id DESC LIMIT 200").all() as Row[]).map((a) => ({
    at: String(a.at), actor: String(a.actor), kind: a.kind, detail: String(a.detail), ticketId: (a.ticket_id as string) ?? undefined,
  })) as AuditEvent[];
  return { tickets, audit };
}

/** Writes the engine's in-memory state back to SQLite in one transaction. */
export function saveEngineState(state: { tickets: Ticket[]; audit: AuditEvent[] }) {
  const d = db();
  d.exec("BEGIN");
  try {
    d.exec("DELETE FROM signatures; DELETE FROM tickets; DELETE FROM audit;");
    const it = d.prepare(`INSERT INTO tickets (id, op, reason, requester_id, requester_name, status, threshold, hash, created_at, granted_at, expires_at, denied_by)
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const is = d.prepare("INSERT INTO signatures (ticket_id, user_id, name, role, signed_at, key_thumbprint) VALUES (?, ?, ?, ?, ?, ?)");
    for (const t of state.tickets) {
      it.run(t.id, t.op, t.reason, t.requester.sub, t.requester.name, t.status, t.threshold, t.hash, t.createdAt,
        t.grantedAt ?? null, t.expiresAt ?? null, t.deniedBy ? JSON.stringify(t.deniedBy) : null);
      for (const s of t.signatures) is.run(t.id, s.sub, s.name, s.role, s.at, s.keyThumbprint);
    }
    const ia = d.prepare("INSERT INTO audit (at, actor, kind, detail, ticket_id) VALUES (?, ?, ?, ?, ?)");
    for (const a of [...state.audit].reverse()) ia.run(a.at, a.actor, a.kind, a.detail, a.ticketId ?? null);
    d.exec("COMMIT");
  } catch (e) {
    d.exec("ROLLBACK");
    throw e;
  }
}
