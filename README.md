# QuorumGate — zero-blind-trust critical access vault

[![Built with TideCloak](https://tide.org/badges/built-with-tidecloak.svg)](https://tide.org/tidecloak?utm_source=github&utm_medium=readme&utm_campaign=unlocked)

*RMIT Hackathon 2026 · Challenge 2 · "Build without blind trust"* — prototype

> One IT admin — or one stolen admin password — should never be able to export a bank's customer
> ledger or grant themselves root. QuorumGate makes every high-risk action need **two independent
> admins**, and the server enforces it.

## Project overview

**QuorumGate** is an admin console where no single administrator can decrypt customer data, grant
themselves root, or add a new admin: every high-risk action needs **two independent admins**,
enforced on the server and recorded in a tamper-evident audit log.

Built with [TideCloak](https://tide.org/tidecloak?utm_source=github&utm_medium=readme&utm_campaign=unlocked).

| Submission file | |
|---|---|
| [`sourcecodes.zip`](sourcecodes.zip) | Application source code (same as the [`quorumgate/`](quorumgate/) folder) |
| [`summary.docx`](summary.docx) | Problem, solution, value, role of TideCloak, and what is mocked |
| [`video.mp4`](video.mp4) | Two-minute working demonstration |
| [Setup](#setup) | How to launch and test the prototype |

### 1. Vision & originality

In most organisations an IT administrator has "God Mode": one person can export the entire customer
database, grant themselves root on production, or quietly create another admin account. QuorumGate
replaces that single point of trust with a **two-person rule built into the application**:

- trying to act alone is **blocked and logged**;
- a request carries a written reason and is sealed with a **SHA-256 hash**;
- the requester can **never approve their own request**;
- a **second, independently signed-in admin** must co-sign before anything happens;
- access is **time-boxed** (10 minutes) and **every view is audited**;
- even **admitting a new admin** needs two approvers, so nobody can create a sock-puppet second
  approver.

### 2. Trust constraint insight

**Authority and custody.** No single administrator should be able to approve a high-risk action
alone, and customer data should not depend on one person's honesty.

The usual answer — "two-person approval" — only works if the second approval really comes from a
second person. If one server stores every password and issues every login, whoever controls that
server can impersonate the second approver and approve their own request. The approval becomes
theatre. Removing that last trusted party is what makes the rule credible.

### 3. Value & impact

- **Banks, hospitals, universities:** a rogue admin or a stolen admin password is no longer enough to
  leak customer, patient or student records.
- **Auditors and regulators** get a complete record of who asked, why, who approved, and who viewed
  what — without trusting the people being audited.
- **Day-to-day work is not slowed down:** an approval takes seconds and access expires on its own.

Example: a bank analyst needs a customer's full card number for a regulator request. They open a
request with the regulator's reference; the security auditor approves it from their own device; the
analyst sees the data for ten minutes; the audit log shows the whole chain.

### 4. Why TideCloak matters

Two-person approval is only as strong as the identity behind each signature. TideCloak provides it:

- **Threshold identity:** Tide splits each identity key across a decentralised network of nodes. No
  server — not ours, not the identity provider's — ever holds a whole key, so nobody can mint a login
  for the second admin and approve their own request.
- **Device-bound tokens (DPoP):** each TideCloak token is bound to a key on the signer's device. Our
  server verifies the token signature **and** the DPoP proof on every request, so a stolen token
  replayed from another machine is rejected.
- **Approvals tied to verified identities:** every signature on a ticket records the signer's Tide
  identity and the thumbprint of the device key they signed with.
- **Governed approver role:** changing who is an approver is itself a quorum-approved change request.

**How it is wired:** `/dashboard` signs in with TideCloak and sends every API call through
`secureFetch` (DPoP). The server (`src/lib/auth/protect.ts`, `src/lib/auth/verifyDpop.ts`) verifies the
token and proof, maps the Tide identity to an admin record, and only then runs the quorum rules
(`src/lib/quorum/serverStore.ts` → `withApprover`). Every API route accepts either a TideCloak token
or a local session.

### 5. Prototype & storytelling

Judges should look for these moments:

1. **Blocked alone** — Operations Admin clicks *Decrypt alone*: red "Unilateral attempt blocked", HTTP 403, logged.
2. **Request with a reason** — *Request access* opens ticket `QG-…` at **1 of 2**, with its hash.
3. **No self-approval** — *Try to self-approve* is refused (four-eyes rule).
4. **Independent co-signature** — Security Auditor, signed in separately, clicks *Sign & approve* → **2 of 2**.
5. **Time-boxed access** — the vault card turns green, records decrypt on screen, a 10-minute countdown starts.
6. **Admitting an admin** — a new sign-up is *pending*; admission needs one approver to request and a different one to co-sign.
7. **Database** — live tables for admins, tickets, signatures, audit log and customers (customers stay masked unless *you* hold an approved ticket).

#### What is real and what is mocked

| Component | Status |
|---|---|
| Two-person rule, no self-approval, 10-minute window | **Real** — enforced on the server (`src/lib/quorum/engine.ts`) |
| Admitting a new admin needs two approvers | **Real** — `ADMIT_ADMIN` ticket; promoted only at 2 of 2 (`src/app/api/tickets/route.ts`) |
| Ledger released only under an approved ticket | **Real** — server-side check, every view logged (`src/app/api/records/route.ts`) |
| SQLite database (admins, sessions, tickets, signatures, audit, customers) | **Real** — `quorumgate/data/quorumgate.db` |
| TideCloak login with DPoP, server-side token + proof verification (`/dashboard`) | **Real code, needs a licensed TideCloak realm** — see note |
| Local sign-in (`/login`, scrypt-hashed passwords, httpOnly session cookie) | **Stand-in** for TideCloak when no licensed realm is available |
| Customer ledger | **Sample data** — all names and numbers are fictional |
| Demo admin accounts | **Demo only** — fixed demo password, not for real use |
| **Reset demo** button | **Demo only** — clears requests, signatures and audit log so the walkthrough can be repeated. A real deployment must not have it (one admin erasing the audit trail is exactly the power QuorumGate removes). Disable with `DEMO_RESET=off` in `.env`. |
| "Elevated root privileges" | **Simulated outcome** — the approval flow is real; no real system is elevated |

> **Note on TideCloak licensing.** During the event, automated realm licensing failed on Tide's
> licensing service (`TIDE-IDPEXT-VENDOR-KEYGEN_FAILED`, `Midgard FinalizeWallet 500`) for two
> licence emails. The TideCloak login is fully wired and works once a realm is licensed. Until then,
> the local stand-in login is used — every quorum rule, the database and the UI behave identically.
>
> **Why that matters:** with the local login, this server stores password hashes and creates
> sessions, so whoever controls it could still impersonate the second admin. TideCloak removes that
> last single point of trust.

## Setup

Requirements: **Node.js 22.5+** (uses Node's built-in SQLite). **Docker Desktop** only if you want the TideCloak path.

### 1. Run the app (about 3 minutes, no Docker)

Download `sourcecodes.zip` and unzip it (or clone the repo), then:

```bash
cd quorumgate
npm install
npm run dev
```

Open <http://localhost:3000>, click **Admin sign in**, and use the demo admins (created on first start, also listed on the sign-in page — click *Use* to fill them in):

| Admin | Email | Password | Role |
|---|---|---|---|
| Aiman Hakim — Operations Admin | `ops.admin@quorumgate.demo` | `QuorumGate2026!` | Approver |
| Priya Nair — Security Auditor | `security.auditor@quorumgate.demo` | `QuorumGate2026!` | Approver |

Set `DEMO_ADMIN_PASSWORD` in `.env` before the first start to use a different password.

> If `npm install` fails with a certificate error, your network is intercepting HTTPS
> (e.g. a campus firewall). Use a phone hotspot.

### 2. Optional: TideCloak path

Open Docker Desktop, then:

```bash
docker run -d --name tidecloak -p 8080:8080 \
  -e KC_BOOTSTRAP_ADMIN_USERNAME=admin -e KC_BOOTSTRAP_ADMIN_PASSWORD=<choose-a-password> \
  tideorg/tidecloak-dev:latest
```

Open <http://localhost:8080>, sign in as `admin`, create a new app with these URIs, activate the Tide
licence, then download the adapter config (`tidecloak.json`) into **`quorumgate/data/tidecloak.json`**:

| Setting | Value |
|---|---|
| Home URL | `http://localhost:3000` |
| Valid redirect URIs | `http://localhost:3000/*` |
| Web origins | `http://localhost:3000` |

(Alternatively `npm run init` scripts all of this; it needs `.env` filled in from `.env.example`.)

Then go to <http://localhost:3000/dashboard> and sign in with two different Tide accounts (one normal
window, one private window). The first two Tide identities become the approvers; later ones start as pending.

## Test the core flow

Use **two browser windows**: a normal one and a private/incognito one (Cmd+Shift+N).

| # | Window | Do this | You should see |
|---|---|---|---|
| 1 | Normal | Sign in as **Aiman** | Console with the sealed Customer Ledger card |
| 2 | Normal | Click **Decrypt alone** | Red *Unilateral attempt blocked* alert; server returns 403; logged as BLOCKED |
| 3 | Normal | Click **Request access**, type a reason, **Sign & send** | Ticket QG-… with a SHA-256 hash, quorum ring at *1 of 2* |
| 4 | Normal | Click **Try to self-approve** | Refused — four-eyes rule; logged as REJECTED |
| 5 | Incognito | Sign in as **Priya**, click **Sign & approve** | Ticket becomes *Approved (2 of 2)* |
| 6 | Normal | Wait up to 4 seconds | Card turns green, records decrypt, 10-minute countdown starts; each view logged as ACCESSED |
| 7 | Either | Click **Database** | Live tables: admin accounts, tickets, signatures, audit log, customer records |

Also try — **admitting a new admin needs two approvers too**:

1. In a third window, **Create account** (e.g. "Ben Tan", IT Administrator). Ben is *pending*: he
   cannot see data, approve, or open the database.
2. As Aiman, open **Database → Admin accounts** and click **Admit** next to Ben. This opens an
   "Admit new admin: Ben Tan" ticket at 1 of 2. Aiman cannot approve it himself.
3. As Priya, click **Sign & approve** on that ticket. Ben becomes an approver once he refreshes.

On the Database page as Priya, customer records stay masked — only the admin who was granted access
sees real values.

## Project layout

```text
src/lib/quorum/engine.ts         Quorum rules (two-person, no self-approval, access window)
src/lib/quorum/serverStore.ts    Loads/saves engine state; withApprover() = TideCloak OR local session
src/lib/db.ts                    SQLite schema, demo admin seeding, persistence
src/lib/auth/local.ts            Local sign-up / sign-in / sessions (scrypt)
src/lib/auth/protect.ts          Server-side TideCloak JWT + DPoP verification
src/app/api/records/route.ts     Ledger API — plaintext only under an approved ticket
src/app/api/tickets/route.ts     Create / approve / deny tickets
src/app/api/db/route.ts          Read-only database viewer (approvers only, never password hashes)
src/app/(public)/                Landing, login, console, database pages
src/app/(live)/                  TideCloak-login console (needs a licensed realm)
src/components/                  UI: console, network animation, effects
scripts/init-tidecloak.sh        TideCloak bootstrap
```

Built with Next.js, TypeScript and Node's built-in SQLite, starting from Tide's
nextjs-customer-portal template. Full walkthrough: [quorumgate/README.md](quorumgate/README.md).