# QuoGate (Zero-Blind-Trust Critical Access Vault)

A multi-party governance vault preventing unilateral administrator abuse over sensitive enterprise data and permissions.

Built with **TideCloak**.

---

## 1. Vision & Originality
In enterprise IT, administrators are routinely granted unilateral "God Mode"—the authority to access any data, export customer databases, or alter privileges without oversight. QuoGate re-architects privileged access by replacing absolute administrative trust with cryptographic multi-party authorization. Critical actions cannot be executed by any single actor, fundamentally eliminating insider threats and single-point-of-failure breaches.

## 2. Trust Constraint Insight
* **The Constraint:** System administrators and cloud hosts possess custody of infrastructure but should not have unconstrained authority to modify access policies or decrypt sensitive payloads alone.
* **The Vulnerability:** Traditional Role-Based Access Control (RBAC) relies on blind trust in admin credentials. A single compromised account or rogue insider can silently exfiltrate confidential records.
* **The Rule:** No administrative elevation or decryption request can resolve without independent quorum consensus (e.g., Primary Admin + Security Auditor).

## 3. Value & Impact
* **Immunity-Sealed Confidentiality:** Critical records remain encrypted at rest and in transit. Server administrators cannot inspect plaintext customer records.
* **Quorum-Enforced Integrity:** Policy and privilege changes require multi-signature approval at the cryptographic layer, making unilateral database tampering impossible.
* **Auditability & Non-Repudiation:** Every access request generates an immutable transaction log tied to authorized approver signatures.

## 4. Why TideCloak Matters
Traditional Identity & Access Management (IAM) tools like standard Keycloak, Okta, or AWS IAM enforce access rules via a central server where root administrators hold overriding power. TideCloak replaces centralized administrative trust with distributed authorization:
* **Decentralized Authority:** Keys are sharded across independent nodes. No single administrator holds full access to override access controls.
* **IGA Admin Governance:** Natively intercepts elevated privilege requests and enforces multi-party quorum sign-offs prior to authorization token issuance.
* **Zero-Knowledge Security:** Eliminates centralized credential storage, rendering credential-stuffing and database leaks ineffective.

## 5. Prototype & Storytelling
Our 2-minute video walkthrough demonstrates:
1. **Unilateral Access Block:** Admin 1 attempts to unmask restricted financial records and grant elevated root privileges. The action is blocked by TideCloak policy enforcement and pushed into a pending quorum queue.
2. **Multi-Party Verification:** Admin 2 (Security Auditor) logs in from an independent session, inspects the request log, and provides the cryptographic co-signature.
3. **Threshold Fulfilled:** The session authorization completes, granting temporary decryption access strictly after quorum consensus is verified.

*(Note on Prototype Architecture: TideCloak IGA governance flows are demonstrated via integrated API endpoints with mock fail-safes clearly identified in source code comments for testing reliability).*

---

## Setup & Run Instructions

### Prerequisites
* Node.js 18+ installed
* Git

### Local Setup
1. Clone the repository:
   ```bash
   git clone [https://github.com/MrBarry7/Rmit-hackathon-2026.git](https://github.com/MrBarry7/Rmit-hackathon-2026.git)
   cd Rmit-hackathon-2026
