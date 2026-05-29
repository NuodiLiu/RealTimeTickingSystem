# Security Document


## 1. Sensitive Data

The system collects and stores the following personal data:

| Data | Where collected | Who can see it |
|------|----------------|----------------|
| Student name | Registration iPad | Authenticated staff only; public display (name + position only) |
| Student zID | Registration iPad | Authenticated staff only |
| Feedback rating and comment | Feedback iPad | Authenticated staff only |
| Staff name and email | Azure AD (on login) | Admin only via export |

**The zID is the highest sensitivity field.** It is a unique university identifier and must never appear on the public display, in unauthenticated API responses, or in client-side state accessible outside the authenticated staff session.

---

## 2. Who Can Access What

Access is controlled by two roles enforced server-side on every request.

| Action | Public (no login) | STAFF | ADMIN |
|--------|:-----------------:|:-----:|:-----:|
| View public queue (name + position only) | ✓ | ✓ | ✓ |
| View full case details (including zID) | — | ✓ | ✓ |
| Take, resolve, or escalate cases | — | ✓ | ✓ |
| Send or override feedback requests | — | ✓ | ✓ |
| View device list and status | — | ✓ | ✓ |
| Pair, rename, or unpair devices | — | — | ✓ |
| Export case and feedback data | — | — | ✓ |

No role claim from the client is trusted. The role is read from the server-side staff record on every request.

---

## 3. Authentication

### Staff
Staff log in using their university Microsoft account via **Azure AD SSO (OAuth 2.0)**. No passwords are stored in the system. On successful login, the backend issues a short-lived **App JWT (2 hours)** for API access and a **refresh token stored in an HTTP-only cookie** (14 days), which is inaccessible to JavaScript.

### iPad Devices
Devices are registered via a **one-time QR code** that expires after use. After pairing, each device is assigned a **unique secret that is immediately hashed** (SHA-256) The plaintext secret is never stored. All subsequent device requests are validated using a **timing-safe hash comparison** to prevent timing attacks.

### What is never permitted
- Password-based staff login
- Reuse of expired or already-scanned pairing QR codes
- Client-side role elevation

---

## 4. Data in Transit

All communication between clients (staff browser, iPad, public display) and the backend uses **HTTPS / TLS**. WebSocket connections (for real-time events) use **WSS** (WebSocket Secure). Plaintext HTTP is not accepted.

Access to all endpoints is restricted to the **university network via IP allowlisting**. The system is not reachable from the public internet.

---

## 5. Public Display Exposure

The public queue display is the only unauthenticated endpoint. It is intentionally limited:

- Shows: **student first name and queue position**
- Does **not** show: zID, problem category, assigned staff, feedback data, or any case history

This is enforced in the backend. The public queue API response is a separate data shape that excludes all fields beyond name and position.

---

## 6. Data at Rest

| Data | Protection |
|------|-----------|
| Student cases and zIDs | Stored in PostgreSQL on Azure; access requires database credentials held in Azure Key Vault |
| Device secrets | Stored as SHA-256 hashes only; plaintext is discarded after pairing |
| Staff refresh tokens | Stored as hashes in the database; the raw token exists only in the HTTP-only cookie |
| Exported Excel files | Generated on demand and streamed directly to the admin browser; not stored on the server |

---

## 7. Key Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Unauthorised access to student zIDs | zID is only returned on authenticated staff endpoints; excluded from all public responses |
| Two staff members seeing different queue states | All state changes broadcast via SignalR immediately; no stale client state |
| Feedback sent to wrong device | KioskLock prevents concurrent sessions; staff explicitly selects the target device |
| Stolen device secret | Secrets are hashed at rest; a compromised device can be unpaired by an admin, invalidating its credentials |
| Session hijacking | Refresh tokens are HTTP-only cookies (not accessible to JavaScript); App JWTs expire in 2 hours |
| SQL injection | All database queries go through Prisma ORM with parameterised queries; no raw SQL for user input |
