# QuorumGate — zero-blind-trust critical access vault

RMIT Hackathon 2026 · Challenge 2 · "Build without blind trust" · built on **TideCloak**

> One IT admin — or one stolen admin password — should never be able to export a bank's customer
> ledger or grant themselves root. QuorumGate makes every high-risk action need **two independent,
> TideCloak-verified people**, enforced on the server.

## Run it

### Option A — Live mode (real TideCloak) · ~5 minutes

Requirements: macOS/Linux, **Docker Desktop running**, Node.js 20+, `curl`, `jq`, and internet
access to `ork1.tideprotocol.com` and `registry.npmjs.org`. Some campus/corporate firewalls
(e.g. Fortinet SSL inspection) block these; use a phone hotspot if `npm install` fails with a
certificate error.

```bash
cd quorumgate
npm install
cp .env.example .env
#   edit .env:
#   KC_BOOTSTRAP_ADMIN_PASSWORD=<choose a strong password>
#   TIDE_LICENSE_EMAIL=<your email>
#   TIDE_TERMS_ACCEPTED=yes        # only after reading https://tide.org/legal
npm run init        # starts TideCloak in Docker, creates + licenses the realm, enables IGA
```

`npm run init` prints **two invite links** and waits:

1. **Admin 1 (Operations Admin)** — open in your normal browser window, create a Tide account.
2. **Admin 2 (Security Auditor)** — open in a **private/incognito** window, create a *different* Tide account.

When both are linked the script finishes and writes `data/tidecloak.json`. Then:

```bash
npm run dev         # http://localhost:3000
```

### Option B — Simulation mode (no TideCloak, runs offline)

```bash
cd quorumgate
npm install
npm run dev         # then open http://localhost:3000/simulation
```

No Docker or TideCloak needed. Two **mocked** admins share one browser via a persona switch
(Admin 1 / Admin 2 in the top bar). The landing page (`/`) also works without TideCloak.

## Test the core flow (live mode)

| Step | Window | Action | Expected |
|---|---|---|---|
| 1 | Normal (Admin 1) | Sign in → **Decrypt ledger now (single admin)** | Red **UNILATERAL ATTEMPT BLOCKED** banner; server returns 403; audit log shows `BLOCKED` |
| 2 | Admin 1 | **Request quorum access** → enter a justification → **Sign & open ticket** | Ticket `QG-…` with SHA-256 tx hash, `PENDING 1/2` |
| 3 | Admin 1 | **Try to self-approve** | Refused — four-eyes rule; audit `REJECTED` |
| 4 | Incognito (Admin 2) | Sign in → **Cryptographically sign & approve** | `QUORUM GRANTED (2/2)` |
| 5 | Admin 1 | (auto-refreshes every 4 s) | Ledger unmasks for 10 minutes; each view logged as `ACCESSED` |

Also try: calling `GET /api/records` with a copied token from another machine or with
`Authorization: Bearer …` instead of DPoP → `401` (DPoP proof check).

## What is real and what is simulated

| Component | Status |
|---|---|
| TideCloak login (threshold-signed tokens via the Tide ORK network) | **Real** |
| DPoP device-bound tokens, verified server-side (`src/lib/auth/verifyDpop.ts`) | **Real** |
| JWT signature + `quorum-approver` role check on every API call (`src/lib/auth/protect.ts`) | **Real** |
| Quorum rules: 2 distinct verified identities, no self-approval, 10-min window (`src/lib/quorum/engine.ts`) | **Real**, enforced on the server |
| TideCloak IGA: realm licensed, IGA enabled; granting `quorum-approver` / admin roles after bootstrap is a change request needing admin approval | **Real** (`scripts/init-tidecloak.sh`) |
| Ticket + audit storage | **Prototype** — in server memory, resets on restart |
| Customer ledger data | **Sample data** — fictional names and numbers |
| `/simulation` page | **Simulated** — identities, keys and signatures are mocked in the browser |
| "Elevated root privileges" | **Simulated outcome** — the quorum flow is real; no actual production system is elevated |

## Where things are

```
scripts/init-tidecloak.sh      TideCloak bootstrap (realm, licence, IGA, two admins, quorum-approver role)
scripts/realm.json.template    Realm definition (adds the quorum-approver role)
src/lib/quorum/engine.ts       Quorum rules (shared by server and simulation)
src/lib/quorum/serverStore.ts  Maps a verified TideCloak JWT to a caller identity
src/app/api/records/route.ts   Ledger API — plaintext only under a GRANTED ticket
src/app/api/tickets/route.ts   Create / approve / deny tickets
src/components/QuorumConsole.tsx  Dashboard UI
src/app/dashboard              Live console (TideCloak)
src/app/simulation             Simulation (mocked)
```

Built from Tide's `nextjs-customer-portal` template (provider, DPoP page, JWT + DPoP verification).
