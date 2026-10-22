import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "crypto";
import { db } from "../db";
import type { Caller } from "../quorum/engine";

// LOCAL LOGIN — a stand-in for TideCloak while the Tide licence cannot be issued.
// Passwords are hashed with scrypt (salted); sessions are random 256-bit ids in an httpOnly cookie.
// Honest limitation (stated in the README/summary): unlike TideCloak, this server CAN see
// password hashes and could mint sessions, i.e. the identity layer itself is a single point of trust.

export const SESSION_COOKIE = "qg_session";
const SESSION_HOURS = 12;
const FOUNDING_APPROVERS = 2; // the first two accounts become approvers; later sign-ups wait for admission

export const JOB_TITLES = [
  "Operations Admin",
  "Security Auditor",
  "IT Administrator",
  "Database Administrator",
  "Compliance Officer",
  "Risk Manager",
] as const;

export interface LocalUser {
  id: string;
  email: string;
  name: string;
  title: string;
  role: "approver" | "pending";
  created_at: string;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [, saltHex, hashHex] = stored.split("$");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(expected, actual);
}

const PUBLIC_COLS = "id, email, name, title, role, created_at";

export function signUp(input: { name?: string; email?: string; password?: string; title?: string }): LocalUser {
  const name = String(input.name ?? "").trim().slice(0, 60);
  const email = String(input.email ?? "").trim().toLowerCase().slice(0, 120);
  const password = String(input.password ?? "");
  const title = String(input.title ?? "").trim();
  if (name.length < 2) throw new AuthError("Please enter your name", 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AuthError("Please enter a valid email", 400);
  if (password.length < 8) throw new AuthError("Password must be at least 8 characters", 400);
  if (!(JOB_TITLES as readonly string[]).includes(title)) throw new AuthError("Please choose your job title", 400);

  const d = db();
  if (d.prepare("SELECT 1 FROM users WHERE email = ?").get(email)) throw new AuthError("An account with this email already exists", 409);
  const existing = (d.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n;
  const role = existing < FOUNDING_APPROVERS ? "approver" : "pending";
  const user = { id: randomUUID(), email, name, title, role, created_at: new Date().toISOString() } as LocalUser;
  d.prepare("INSERT INTO users (id, email, name, title, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(user.id, email, name, title, hashPassword(password), role, user.created_at);
  return user;
}

export function logIn(emailRaw: string, password: string): LocalUser {
  const email = String(emailRaw ?? "").trim().toLowerCase();
  const row = db().prepare(`SELECT ${PUBLIC_COLS}, password_hash FROM users WHERE email = ?`).get(email) as (LocalUser & { password_hash: string }) | undefined;
  // Same message either way, so the form doesn't reveal which emails exist.
  if (!row || !verifyPassword(String(password ?? ""), row.password_hash)) throw new AuthError("Incorrect email or password", 401);
  const { password_hash: _omit, ...user } = row;
  void _omit;
  return user;
}

export function createSession(userId: string): { id: string; expires: Date } {
  const id = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_HOURS * 3600_000);
  db().prepare("INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
    .run(id, userId, new Date().toISOString(), expires.toISOString());
  return { id, expires };
}

export function destroySession(id: string | undefined) {
  if (id) db().prepare("DELETE FROM sessions WHERE id = ?").run(id);
}

export function userFromSession(id: string | undefined): (LocalUser & { sessionId: string }) | null {
  if (!id) return null;
  const row = db()
    .prepare(`SELECT u.id, u.email, u.name, u.title, u.role, u.created_at, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`)
    .get(id) as (LocalUser & { expires_at: string }) | undefined;
  if (!row) return null;
  if (Date.parse(row.expires_at) < Date.now()) {
    destroySession(id);
    return null;
  }
  const { expires_at: _e, ...user } = row;
  void _e;
  return { ...user, sessionId: id };
}

export function readSessionCookie(req: Request): string | undefined {
  const raw = req.headers.get("cookie") ?? "";
  const m = raw.split(/;\s*/).find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  return m ? decodeURIComponent(m.slice(SESSION_COOKIE.length + 1)) : undefined;
}

export function sessionCookie(id: string, expires: Date): string {
  return `${SESSION_COOKIE}=${encodeURIComponent(id)}; Path=/; HttpOnly; SameSite=Lax; Expires=${expires.toUTCString()}`;
}

export function clearedCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function callerFromUser(u: LocalUser & { sessionId: string }): Caller {
  // The "key" shown on signatures: a fingerprint of the session that signed (not the secret itself).
  return { sub: u.id, name: u.name, keyThumbprint: "sess-" + createHash("sha256").update(u.sessionId).digest("hex").slice(0, 12) };
}

/** Route wrapper: requires a valid session; `approverOnly` also requires the approver role. */
export function withSession(
  handler: (req: Request, user: LocalUser & { sessionId: string }) => Promise<Response> | Response,
  opts: { approverOnly?: boolean } = {}
) {
  return async (req: Request) => {
    const user = userFromSession(readSessionCookie(req));
    if (!user) return Response.json({ error: "Please sign in" }, { status: 401 });
    if (opts.approverOnly && user.role !== "approver") {
      return Response.json({ error: "Your account is waiting to be admitted as an approver" }, { status: 403 });
    }
    return handler(req, user);
  };
}
