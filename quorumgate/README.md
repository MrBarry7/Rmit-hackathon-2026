# QuorumGate — zero-blind-trust critical access vault

**RMIT Hackathon 2026 · Challenge 2 · "Build without blind trust"** — prototype

> One IT admin — or one stolen admin password — should never be able to export a bank's customer
> ledger or grant themselves root. QuorumGate makes every high-risk action need **two independent
> admins**, and the server enforces it.

---

## Run it (about 3 minutes)

Requirements: **Node.js 22.5 or newer** (uses Node's built-in SQLite). No Docker, no database server.

```bash
cd quorumgate
npm install
npm run dev
```

Open **http://localhost:3000**.

> If `npm install` fails with a certificate error, your network is intercepting HTTPS
> (e.g. a campus firewall). Use a phone hotspot.

### Demo admin accounts (prototype only)

Created automatically the first time the app starts. They are also listed on the sign-in page —
click **Use** to fill them in.

| Admin | Email | Password | Role |
|---|---|---|---|
| Aiman Hakim — Operations Admin | `ops.admin@quorumgate.demo` | `QuorumGate2026!` | Approver |
| Priya Nair — Security Auditor | `security.auditor@quorumgate.demo` | `QuorumGate2026!` | Approver |

Set `DEMO_ADMIN_PASSWORD` in `.env` before the first start to use a different password.

---

## Test the core flow

Use **two browser windows**: a normal one and a private/incognito one (`Cmd+Shift+N`).

| # | Window | Do this | You should see |
|---|---|---|---|
| 1 | Normal | Sign in as **Aiman** | Console with the sealed Customer Ledger card |
| 2 | Normal | Click **Decrypt alone** | Red **Unilateral attempt blocked** alert; server returns 403; logged as `BLOCKED` |
| 3 | Normal | Click **Request access**, type a reason, **Sign & send** | Ticket `QG-…` with a SHA-256 hash, quorum ring at **1 of 2** |
| 4 | Normal | Click **Try to self-approve** | Refused — four-eyes rule; logged as `REJECTED` |
| 5 | Incognito | Sign in as **Priya**, click **Sign & approve** | Ticket becomes **Approved (2 of 2)** |
| 6 | Normal | Wait up to 4 seconds | Card turns green, records decrypt on screen, 10-minute countdown starts; each view logged as `ACCESSED` |
| 7 | Either | Click **Database** | Live tables: admin accounts, tickets, signatures, audit log, customer records |

Also try:
- **Create account** with a new email → the account is **pending**: it cannot see data, approve, or open
  the database. This stops anyone creating a fake second approver.
- On the Database page as Priya, **Customer records** stay masked — only the admin who was granted
  access sees real values, even in the database view.

---

## What is real and what is simulated

| Component | Status |
|---|---|
| Two-person rule (2 distinct admins, no self-approval, 10-minute access window) | **Real** — enforced on the server (`src/lib/quorum/engine.ts`) |
| Ledger API releases data only under an approved ticket | **Real** — `src/app/api/records/route.ts` |
| Sign-up / sign-in, salted scrypt password hashes, httpOnly session cookie | **Real**, but a **stand-in for TideCloak** (see below) |
| SQLite database: users, sessions, tickets, signatures, audit log, customers | **Real** — `data/quorumgate.db` |
| Customer ledger data | **Sample data** — every name and number is fictional |
| Demo admin accounts | **Prototype convenience** — fixed demo password, not for real use |
| "Elevated root privileges" | **Simulated outcome** — the approval flow is real; no real system is elevated |
| TideCloak login (threshold identity, DPoP device-bound tokens, IGA-governed approver role) | **Built but not running** — see below |

### TideCloak status

The TideCloak integration is in the code: `scripts/init-tidecloak.sh` (realm, licence, IGA, two
admins, `quorum-approver` role), `src/app/(live)/` (TideCloak login with DPoP), and
`src/lib/auth/protect.ts` (server-side JWT + DPoP verification). Every API route accepts either a
TideCloak token or a local session (`withApprover` in `src/lib/quorum/serverStore.ts`).

During the hackathon, TideCloak realm licensing failed on Tide's licensing service with
`TIDE-IDPEXT-VENDOR-KEYGEN_FAILED` / `Midgard FinalizeWallet 500` for two different licence emails, so
the prototype runs on the local login instead.

**Why that matters:** with the local login, *this* server stores password hashes and creates
sessions, so whoever controls it could still impersonate the second admin. TideCloak removes that
last single point of trust: identity keys are split across a decentralised network and no server
ever holds them whole, so a second approval cannot be forged — and changing who is an approver is
itself a quorum-approved change request.

To try the TideCloak path (needs Docker and a working Tide licence): copy `.env.example` to `.env`,
fill in the values, run `npm run init`, then sign in at `/dashboard`.

---

## Project layout

```text
src/lib/quorum/engine.ts         Quorum rules (two-person, no self-approval, access window)
src/lib/quorum/serverStore.ts    Loads/saves engine state; withApprover() = TideCloak OR local session
src/lib/db.ts                    SQLite schema, demo admin seeding, persistence
src/lib/auth/local.ts            Local sign-up / sign-in / sessions (scrypt)
src/app/api/records/route.ts     Ledger API — plaintext only under an approved ticket
src/app/api/tickets/route.ts     Create / approve / deny tickets
src/app/api/db/route.ts          Read-only database viewer (approvers only, never password hashes)
src/app/(public)/                Landing, login, console, database pages
src/app/(live)/                  TideCloak-login console (needs a licensed realm)
src/components/                  UI: console, network animation, effects
scripts/init-tidecloak.sh        TideCloak bootstrap
```

Built with Next.js, TypeScript and Node's built-in SQLite, starting from Tide's
`nextjs-customer-portal` template.
