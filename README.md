![built with TideCloak](https://img.shields.io/badge/built%20with-TideCloak-black)

# Project overview

**QuorumGate — Zero-Blind-Trust Critical Access Vault**

One IT admin — or one stolen admin password — should never be able to export a bank's customer ledger or grant themselves root. QuorumGate makes every high-risk action require **two independent, TideCloak-verified people**, enforced on the server.

Built with [TideCloak](https://tide.org/tidecloak).

---

## 1. Vision & originality
In enterprise IT, administrators are routinely granted unilateral "God Mode"—the authority to access any data, export customer databases, or alter privileges without oversight. QuorumGate re-architects privileged access by replacing absolute administrative trust with cryptographic multi-party authorization. Critical actions cannot be executed by any single actor, fundamentally eliminating insider threats and single-point-of-failure breaches.

## 2. Trust constraint insight
* **The Constraint:** System administrators and cloud hosts possess custody of infrastructure but should not have unconstrained authority to modify access policies or decrypt sensitive payloads alone.
* **The Vulnerability:** Traditional Role-Based Access Control (RBAC) relies on blind trust in admin credentials. A single compromised account or rogue insider can silently exfiltrate confidential records.
* **The Rule:** No administrative elevation or decryption request can resolve without independent quorum consensus (four-eyes principle: Operations Admin + Security Auditor) with no self-approval allowed.

## 3. Value & impact
* **Confidentiality:** Customer ledger records remain masked on the server and are only exposed in plaintext under an active, multi-party `GRANTED` ticket for a strict 10-minute window.
* **Quorum-Enforced Integrity:** High-risk actions require 2 distinct verified identities with the `quorum-approver` role, enforced server-side.
* **Device-Bound Security & Auditability:** Uses DPoP (Demonstrating Proof-of-Possession) device-bound tokens verified server-side alongside an audit log tracking `BLOCKED`, `REJECTED`, and `ACCESSED` events.

## 4. Why TideCloak matters
Traditional Identity & Access Management (IAM) tools enforce access rules via a central server where root administrators hold overriding power. TideCloak replaces centralized administrative trust with distributed authorization:
* **Threshold-Signed Tokens:** User authentication tokens are threshold-signed via the Tide ORK network.
* **IGA Admin Governance:** With Identity Governance and Administration (IGA) enabled on the licensed realm, granting `quorum-approver` or admin roles after bootstrap requires an approved change request rather than unilateral assignment.
* **DPoP Protection:** Prevents token replay or theft across machines (`src/lib/auth/verifyDpop.ts`).

## 5. Prototype & storytelling

### What is real and what is simulated

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

---

## Setup & Run Instructions

### Option A — Simulation mode (no TideCloak, runs offline immediately)

No Docker or TideCloak needed. Two mocked admins share one browser via a persona switch (Admin 1 / Admin 2 in the top bar).

```bash
cd quorumgate
npm install
npm run dev
