# Technical High-Level Design




## Table of Contents

1. [Overview](#1-overview)
2. [System Context (C4 Level 1)](#2-system-context-c4-level-1)
3. [Container Architecture (C4 Level 2)](#3-container-architecture-c4-level-2)
4. [Component Architecture (C4 Level 3)](#4-component-architecture-c4-level-3)
5. [Technology Stack](#5-technology-stack)
6. [Key Architectural Patterns](#6-key-architectural-patterns)
7. [Authentication Architecture](#7-authentication-architecture)
8. [Real-Time Communication Architecture](#8-real-time-communication-architecture)
9. [Data Architecture Overview](#9-data-architecture-overview)
10. [Cloud Architecture Overview](#10-cloud-architecture-overview)

---

## 1. Overview

The system is a three-tier, cloud-hosted application that manages student walk-in enquiries. It is composed of three distinct client applications: a native iPad kiosk app, a web-based staff dashboard, and a public display screen, backed by a single REST API with real-time event delivery via Azure SignalR.

The system is designed around three architectural concerns:

1. **Real-time state synchronisation** — all connected clients (staff dashboards, iPad kiosks, public displays) must reflect the same queue state within seconds of any change
2. **Device-aware workflow** — physical iPad devices are first-class participants in the system; they receive commands, hold locks, and transition through their own lifecycle
3. **Layered separation of concerns** — the backend enforces a strict boundary between routing, business logic, and data access to support maintainability and testability

---

## 2. System Context (C4 Level 1)

This view shows the Real-Time Ticketing System as a black box and its relationships with external actors and systems.

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Student   │     │  Frontdesk  │     │   Manager   │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │ Uses kiosk        │ Manages cases     │ Reviews reports
       │ to register /     │ and devices via   │ and configures
       │ give feedback     │ browser           │ operations
       │                   │                   │
       └───────────┬───────┘───────────────────┘
                   │
       ┌───────────▼────────────────────────────────────┐
       │                Ticketing System                │
       │  Manages student enquiries, staff processing   │
       │  workflow, feedback collection, and reporting  │
       └──────────────┬──────────────┬─────────────────┘
                      │              │
          ┌───────────▼──┐    ┌──────▼──────────┐
          │  Azure AD    │    │  Excel /        │
          │  (Auth SSO)  │    │  Power BI       │
          │              │    │  (Reporting)    │
          └──────────────┘    └─────────────────┘
```

**External Systems:**

| System | Direction | Purpose |
|--------|-----------|---------|
| Microsoft Azure Active Directory | Backend calls out | Validates staff identity during SSO login; issues identity tokens |
| Excel / Power BI | Data flows out | Admin exports case and feedback data for operational reporting |

---

## 3. Container Architecture (C4 Level 2)

This view breaks the system into its independently deployable containers and shows how they communicate.

```
╔══════════════════════════════════════════════════════════════════╗
║                    Real-Time Ticketing System                    ║
║                                                                  ║
║  ┌───────────────────┐      ┌───────────────────────────────┐    ║
║  │  iPad Kiosk App   │      │      Staff Dashboard          │    ║
║  │                   │      │                               │    ║
║  │  SwiftUI / Swift  │      │  Next.js 15, React,           │    ║
║  │  iOS 16+          │      │  TypeScript, Tailwind CSS     │    ║
║  │                   │      │                               │    ║
║  │  - Student reg.   │      │  - Live queue view            │    ║
║  │  - Feedback UI    │      │  - Case management            │    ║
║  └──────┬────────────┘      │  - Device management          │    ║
║         │                   │  - Data export                │    ║
║         │  HTTPS REST       └──────────────┬────────────────┘    ║
║         │  (device JWT)                    │ HTTPS REST          ║
║         │                                  │ (app JWT)           ║
║         └──────────────┬───────────────────┘                     ║
║                        │                                         ║
║              ┌─────────▼──────────────┐                          ║
║              │      Backend API       │                          ║ 
║              │                        │◄── Azure AD (auth)       ║
║              │  Node.js / Express     │                          ║
║              │  TypeScript            │                          ║
║              │                        │                          ║
║              │  - Auth / sessions     │                          ║
║              │  - Case management     │                          ║
║              │  - Device management   │                          ║
║              │  - Feedback workflow   │                          ║
║              │  - Excel export        │                          ║
║              └────┬──────────┬────────┘                          ║
║                   │          │                                   ║
║         ┌─────────▼──┐  ┌────▼──────────────────────┐            ║
║         │ PostgreSQL  │  │  Azure SignalR Service     │          ║
║         │ Database    │  │                           │           ║
║         │             │  │  Cloud-managed WebSocket   │◄─────────╫──── iPad
║         │  Prisma ORM │  │  hub routing real-time     │          ║    Kiosk
║         │             │  │  messages to dashboards   │◄───────── ╫──── Staff
║         └─────────────┘  │  and kiosk devices        │           ║    Dashboard
║                           └───────────────────────────┘          ║
╚══════════════════════════════════════════════════════════════════╝
```

### Container Summary

| Container | Technology | Deployment | Responsibility |
|-----------|-----------|------------|----------------|
| **Staff Dashboard** | Next.js 15, TypeScript, Tailwind CSS, Zustand | Azure Static Web Apps / App Service | Web UI for staff and admin — queue management, case handling, device admin, data export |
| **iPad Kiosk App** | Swift, SwiftUI (iOS 16+) | Apple App Store / MDM | On-device student UI for case registration and feedback submission |
| **Backend API** | Node.js 20, Express 5, TypeScript | Azure App Service (Docker container) | REST API, business logic, authentication, database access, SignalR message dispatch |
| **Operational Database** | PostgreSQL 15 | Azure Database for PostgreSQL | Persistent storage for all operational data — cases, staff, devices, feedback, sessions |
| **Real-time Messaging** | Azure SignalR Service | Azure managed service | Cloud-managed WebSocket hub; routes events between backend, dashboards, and kiosks |

### Communication Protocols

| From | To | Protocol | Auth |
|------|----|----------|------|
| Staff Dashboard | Backend API | HTTPS / REST | App JWT (Bearer token) |
| Staff Dashboard | Azure SignalR | WSS (WebSocket) | Negotiation token from backend |
| iPad Kiosk App | Backend API | HTTPS / REST | Device JWT (Bearer token) |
| iPad Kiosk App | Azure SignalR | WSS (WebSocket) | Negotiation token from backend |
| Backend API | Azure SignalR | HTTPS SDK | Azure connection string |
| Backend API | Azure AD | HTTPS / OIDC | Client credentials (MSAL) |
| Public Display | Backend API | HTTPS / REST | None |

---

## 4. Component Architecture (C4 Level 3)

This view zooms into the Backend API container and shows its internal components.

```
┌────────────────────────────────────────────────────────────────────────┐
│                            Backend API                                 │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                     Transport Layer                              │  │
│  │  Express HTTP Server │ Global Middleware (CORS, Helmet, Cookies) │  │
│  └──────────────────────────────┬───────────────────────────────────┘  │
│                                 │                                      │
│  ┌──────────────────────────────▼───────────────────────────────────┐  │
│  │                  Authentication & Session Component              │  │
│  │  Azure AD / MSAL │ JWT issuance │ Refresh tokens │ Middleware    │  │
│  └──────────────────────────────┬───────────────────────────────────┘  │
│                                 │                                      │
│  ┌──────────────────────────────▼───────────────────────────────────┐  │
│  │                      API Endpoint Component                      │  │
│  │  Auth Router │ Cases Router │ Device Router │ Feedback Router    │  │
│  │  Pair Router │ Excel Router │ SignalR Routes                     │  │
│  └───┬──────────┬──────────────┬───────────────┬──────────────┬────-┘  │
│      │          │              │               │              │        │
│  ┌───▼───┐ ┌────▼────┐ ┌───────▼──────┐ ┌─────▼──────┐ ┌────▼────┐     │
│  │ Case  │ │ Device  │ │   Feedback   │ │  Pairing   │ │Reporting│     │
│  │ Mgmt  │ │  Mgmt   │ │    Mgmt      │ │   Mgmt     │ │  Comp.  │     │
│  │ Comp. │ │  Comp.  │ │    Comp.     │ │   Comp.    │ │         │     │
│  └───┬───┘ └────┬────┘ └───────┬──────┘ └────────────┘ └─────────┘     │
│      │          │              │                                       │
│      └──────────┴──────────────┴──────────────────────────────────┐    │
│                                                                    │   │
│  ┌─────────────────────────────────────────────┐  ┌───────────────▼─┐  │
│  │          SignalR Integration Component      │  │  Persistence    │  │
│  │  Client SDK │ Group management │ Event types│  │  Component      │  │
│  └─────────────────────────────────────────────┘  │  (Prisma ORM)   │  │
│                                                   └─────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

### Backend Component Responsibilities

| Component | Files | Responsibility |
|-----------|-------|----------------|
| **Transport Layer** | `expressApp.ts`, `server.ts` | HTTP server bootstrap, global middleware (CORS, Helmet, body parsing, cookie parsing) |
| **Auth & Session Component** | `auth/azure.ts`, `middlewares/auth.middleware.ts`, `middlewares/jwt-auth.middleware.ts`, `services/staff.service.ts` | Azure AD OAuth flow, JWT issuance and validation, refresh token management, staff account provisioning |
| **API Endpoint Component** | `routers/*.ts`, `controllers/*.ts` | Request routing, input validation, response formatting; delegates to business components |
| **Case Management Component** | `services/cases.service.ts` | FIFO queue logic, case state machine (QUEUED → IN_PROGRESS → RESOLVED_PENDING_FEEDBACK → RESOLVED), concurrent-take prevention |
| **Device Management Component** | `services/device.service.ts`, `services/device-cleanup.service.ts` | Device heartbeat tracking, online/offline status, JWT issuance for devices, cleanup of stale devices |
| **Feedback Management Component** | `services/feedback.service.ts`, `services/utils/feedback.utils.ts` | Feedback session lifecycle (CREATED → DELIVERED → SUBMITTED), KioskLock management, override and expiry handling |
| **Pairing Management Component** | `services/pair.service.ts` | One-time QR token generation and consumption, device registration |
| **Reporting Component** | `services/excel.service.ts` | Query and format case + feedback data for Excel export |
| **SignalR Integration Component** | `signalr/client.ts`, `signalr/eventHandler.ts`, `signalr/config.ts` | Abstraction over Azure SignalR SDK; sends typed events to named device groups and the dashboard group |
| **Persistence Component** | `lib/prisma.ts` | Shared Prisma client instance; all database access passes through this singleton |

### Frontend Component Structure

| Component | Location | Responsibility |
|-----------|----------|----------------|
| **Auth Store** | `stores/authStore.ts` | Zustand global state — user identity, auth status, single-flight initialisation |
| **API Client** | `lib/api.ts` | Axios client with JWT injection interceptor and 401 auto-logout |
| **SignalR Client** | `lib/signalr.ts` | SignalR HubConnection setup and connection lifecycle |
| **Queue Hook** | `hooks/useQueue.ts` | Case queue state with real-time SignalR updates |
| **Devices Hook** | `hooks/useDevices.ts` | Device list state with real-time SignalR updates |
| **Dashboard Page** | `app/dashboard/` | Primary staff interface — queue, active cases, device panel |
| **Public Display Page** | `app/public-display/` | Unauthenticated live queue view |

---

## 5. Technology Stack

### Backend

| Concern | Technology | Rationale |
|---------|-----------|-----------|
| Runtime | Node.js 20 | LTS version; async-first model suits real-time and I/O-heavy workload |
| Framework | Express 5 | Lightweight, well-understood; async error propagation in v5 |
| Language | TypeScript 5.9 | Type safety across the full stack; shared types with frontend possible |
| ORM | Prisma | Type-safe database access; migration management; avoids raw SQL errors |
| Database | PostgreSQL 15 | Relational integrity for case/feedback relationships; ACID transactions for state transitions |
| Authentication | MSAL Node (Azure AD) | College uses Microsoft 365; MSAL is the official Microsoft library |
| Real-time | Azure SignalR Service | Managed WebSocket hub; no self-hosted connection server required; scales across multiple backend instances |
| Token format | JWT (jose) | Stateless auth tokens; short-lived app JWTs + HTTP-only refresh cookies |
| Containerisation | Docker (multi-stage) | Consistent build; minimal production image using Node.js alpine |
| Testing | Jest 30, Supertest | Standard Node.js testing stack; Supertest allows HTTP-level integration tests |
| Export | xlsx library | Generates Excel files in-process without external service dependency |

### Frontend (Staff Dashboard)

| Concern | Technology | Rationale |
|---------|-----------|-----------|
| Framework | Next.js 15 (App Router) | SSR/SSG capability; file-based routing; standalone mode for Docker deployment |
| Language | TypeScript | Consistent with backend; IDE type checking for API responses |
| Styling | Tailwind CSS 4 | Utility-first; no separate CSS files; fast iteration |
| State management | Zustand 5 | Lightweight global store; replaces MSAL Provider for auth state |
| Real-time client | @microsoft/signalr | Official SignalR client; connects to Azure SignalR using negotiation endpoint |
| Notifications | React Hot Toast | Lightweight toast library for operation feedback |
| Icons | Lucide React | Consistent icon set; tree-shakeable |

### iPad Kiosk Application

| Concern | Technology | Rationale |
|---------|-----------|-----------|
| Language | Swift | Apple-native language; required for iOS app distribution |
| UI Framework | SwiftUI | Declarative UI; suitable for kiosk-style screens |
| Architecture | MVVM with DI | Testable view models; services injected for unit testing |
| Deployment target | iOS 16.0+ | Covers all iPads that support modern SwiftUI features |
| Real-time | WebSocket (native + SignalR) | Receives backend commands (show feedback screen, device paired, etc.) |

### Infrastructure

| Concern | Technology |
|---------|-----------|
| Cloud provider | Microsoft Azure |
| Backend hosting | Azure App Service (Docker container) |
| Frontend hosting | Azure Static Web Apps or App Service |
| Database | Azure Database for PostgreSQL (Flexible Server) |
| Real-time | Azure SignalR Service |
| Identity | Microsoft Entra ID (Azure AD) |
| Secrets | Azure Key Vault |
| Monitoring | Azure Application Insights |
| Local dev | Docker Compose (PostgreSQL + Redis + NGINX + backend + pgAdmin) |
| CI/CD | GitHub Actions |

---

## 6. Key Architectural Patterns

### 6.1 Layered Architecture (Backend)

The backend enforces a four-layer architecture. Each layer may only call the layer directly below it:

```
HTTP Request
     │
     ▼
Router (route definition, no logic)
     │
     ▼
Middleware (auth, validation)
     │
     ▼
Controller (parse request → call service → format response)
     │
     ▼
Service (business logic, state transitions, SignalR dispatch)
     │
     ▼
Prisma Client (database queries)
     │
     ▼
PostgreSQL
```

### 6.2 Case State Machine

StudentCase transitions are strictly controlled. No backward transitions are allowed.

```
    ┌─────────┐
    │ QUEUED  │◄── iPad submits registration
    └────┬────┘
         │ Staff takes case
         ▼
  ┌─────────────┐
  │ IN_PROGRESS │◄── staffId assigned, startedAt set
  └──────┬──────┘
         │ Staff resolves case
         ▼
┌──────────────────────────┐
│ RESOLVED_PENDING_FEEDBACK│◄── awaiting feedback
└──────────────┬───────────┘
               │ Feedback submitted OR overridden
               ▼
          ┌──────────┐
          │ RESOLVED │◄── final state
          └──────────┘

Parallel path: IN_PROGRESS → Escalate (escalatedTo set, then → RESOLVED)
```

### 6.3 Feedback Session Lifecycle

The feedback workflow involves three coordinated records to guarantee device exclusivity and prevent duplicate feedback:

```
Staff clicks "Send Feedback"
         │
         ▼
  ┌─────────────────────────────────────────┐
  │ 1. KioskLock created (ACTIVE)           │
  │    - Prevents another session on device │
  │    - Has lease expiry time              │
  └─────────────────┬───────────────────────┘
                    │
                    ▼
  ┌─────────────────────────────────────────┐
  │ 2. FeedbackSession created (CREATED)    │
  │    - Links case, staff, device          │
  └─────────────────┬───────────────────────┘
                    │
                    ▼
  ┌─────────────────────────────────────────┐
  │ 3. SignalR FEEDBACK_REQUEST sent        │
  │    - Backend → Azure SignalR → iPad     │
  └─────────────────┬───────────────────────┘
                    │
         iPad shows feedback screen
                    │
         Student submits rating
                    │
                    ▼
  ┌──────────────────────────────────────────┐
  │ 4. FeedbackSession → SUBMITTED           │
  │    KioskLock → COMPLETED                 │
  │    StudentCase → RESOLVED                │
  │    Feedback record created               │
  └──────────────────────────────────────────┘
```

Override path: Staff clicks override → FeedbackSession → OVERRIDDEN, KioskLock → OVERRIDDEN, Case → RESOLVED (no Feedback record created)

### 6.4 FIFO Queue with Concurrent-Take Prevention

When multiple staff members are logged in, race conditions on "take next case" are prevented at the database level using a transaction with an exclusive row lock. Only one staff member's transaction commits; the other retries and either takes the now-next case or finds the queue empty.

### 6.5 Real-Time Event Fan-Out

All state changes are propagated to connected clients immediately after the database write. The backend sends events to two named groups:

- **`dashboard`** — all connected staff dashboards receive `case:created`, `case:updated`, `device:updated`, `device:online`
- **`device:{id}`** — a specific iPad receives `FEEDBACK_REQUEST`, `LEASE`, `UNPAIRED`, `PING`

This group-based model means the backend does not track individual connection IDs for dashboards.

### 6.6 Device Authentication Separation

iPads use a different authentication path from staff:

- **Staff**: Azure AD OAuth → App JWT (2-hour) + refresh cookie (14-day)
- **Devices**: Device secret (hashed, stored at pairing time) → Device JWT (short-lived, for SignalR negotiation)

This separation means device credentials cannot be used to access staff-only endpoints, and vice versa.

---

## 7. Authentication Architecture

### 7.1 Staff Authentication Flow

```
Browser                     Backend                   Azure AD
   │                           │                          │
   │  GET /auth/login           │                          │
   │──────────────────────────►│                          │
   │                           │  Build auth URL (MSAL)   │
   │                           │─────────────────────────►│
   │  302 redirect to Azure AD │                          │
   │◄──────────────────────────│                          │
   │                           │                          │
   │        User logs in on Azure AD portal               │
   │──────────────────────────────────────────────────────►
   │                           │                          │
   │  GET /auth/redirect?code= │                          │
   │──────────────────────────►│                          │
   │                           │  Exchange code for token │
   │                           │─────────────────────────►│
   │                           │  Azure AD ID token       │
   │                           │◄─────────────────────────│
   │                           │                          │
   │                           │  getOrCreateStaff()      │
   │                           │  (creates/updates DB row)│
   │                           │                          │
   │                           │  Issue App JWT (2h)      │
   │                           │  Set refresh cookie (14d)│
   │  302 to /auth/callback    │                          │
   │◄──────────────────────────│                          │
   │  ?token=<app-jwt>         │                          │
   │                           │                          │
   │  Store JWT in Zustand     │                          │
   │  All API calls use        │                          │
   │  Authorization: Bearer    │                          │
```

### 7.2 Token Types

| Token | Issued by | Stored in | Lifetime | Used for |
|-------|-----------|-----------|----------|---------|
| Azure AD ID Token | Azure AD | Backend only (not persisted) | Minutes | Identity claim extraction during login |
| App JWT | Backend | Frontend localStorage (via Zustand) | 2 hours | All authenticated API requests |
| Refresh Token (hash) | Backend | HTTP-only cookie + DB hash | 14 days | Obtain new App JWT without re-login |
| Device JWT | Backend | iPad app memory | Short-lived | SignalR negotiation |

### 7.3 Role-Based Access Control

| Role | Queue / Cases | Feedback | Device Admin | Data Export |
|------|--------------|----------|--------------|-------------|
| STAFF | Read + take + resolve + escalate | Send + override | View only | No |
| ADMIN | All STAFF permissions | All STAFF permissions | Full (pair, rename, mode, delete) | Yes |

---

## 8. Real-Time Communication Architecture

### 8.1 Azure SignalR in Default (Persistent Connection) Mode

The system uses Azure SignalR Service in **Default mode** (not serverless). The backend holds a persistent connection to SignalR and uses the server-side SDK to push messages to named groups. Clients connect to SignalR directly using a token negotiated via the backend.

```
iPad / Dashboard                Backend API              Azure SignalR
       │                             │                        │
       │  POST /device/ws-token      │                        │
       │────────────────────────────►│                        │
       │  { url, accessToken }       │                        │
       │◄────────────────────────────│                        │
       │                             │                        │
       │  Connect to SignalR         │                        │
       │────────────────────────────────────────────────────► │
       │                             │                        │
       │  (connected)                │                        │
       │                             │                        │
       │  (later: case resolved)     │                        │
       │                             │  Send to "device:{id}" │
       │                             │───────────────────────►│
       │  FEEDBACK_REQUEST message   │                        │
       │◄──────────────────────────────────────────────────── │
```

### 8.2 Event Types

**Backend → Dashboard (group: `dashboard`)**

| Event | Trigger | Payload |
|-------|---------|---------|
| `case:created` | Student registers case | Case data |
| `case:updated` | Case status changes (taken, resolved, escalated) | Updated case data |
| `device:updated` | Device mode, name, or status changes | Updated device data |
| `device:online` | Device heartbeat received | Device ID, online status |

**Backend → iPad (group: `device:{id}`)**

| Event | Trigger | Payload |
|-------|---------|---------|
| `FEEDBACK_REQUEST` | Staff sends feedback request | Session ID, case data |
| `LEASE` | Feedback session lease renewed | Expiry time |
| `UNPAIRED` | Admin unpairs device | — |
| `PING` | Health check | — |

**iPad → Backend (via REST, not SignalR)**

All iPad-originated actions (submit case, submit feedback, heartbeat) are REST calls, not WebSocket messages. SignalR is receive-only for iPads.

### 8.3 Auto-Reconnection

Both the iPad app and the staff dashboard implement automatic reconnect logic. If the SignalR connection drops, clients re-negotiate a token and reconnect without user intervention. The backend tolerates brief disconnections; device online status is determined by heartbeat interval, not connection state alone.

---

## 9. Data Architecture Overview

### 9.1 Core Entity Relationships

```
Staff ────────────────────────── StudentCase
  │   1:many (assigned cases)        │
  │                               1:1 (optional)
  │                               Feedback
  │
  │   1:many
KioskLock ─────────────--------- KioskDevice
  │   (one active lock               │
  │    per device at a time)         │ 1:many
  │                             FeedbackSession
  │                                  │
  └──────────────────────── StudentCase (1:many)
```

### 9.2 Key Design Decisions

**Optimistic locking on KioskLock** — a `version` field on KioskLock prevents two concurrent operations from both believing they have exclusive device access. Any write to KioskLock must include the current version; a mismatch causes the write to fail and be retried.

**Soft delete on KioskDevice** — devices are never hard-deleted; `deletedAt` is set instead. This preserves historical case and feedback associations that reference the device.

**Identity key for Azure AD users** — Staff records store an `identityKey` of the form `aad:{tenantId}:{objectId}` rather than the raw Azure AD object ID. This provides a stable, human-readable key that survives Microsoft account migrations.

**Composite indexes for performance** — the two most frequently queried patterns are indexed:
- `(status, createdAt)` on StudentCase — supports FIFO queue queries filtered by status
- `(deviceId, status, createdAt)` on FeedbackSession — supports finding the active session for a device

### 9.3 Data Retention

All operational records (cases, feedback, sessions) are retained indefinitely unless explicitly purged. The Excel export functionality is the primary mechanism for extracting historical data for analysis.

---

## 10. Cloud Architecture Overview

The following diagram shows how the system components map to Azure services.

```
                         ┌─────────────────────────────────────────────────┐
                         │              Microsoft Azure                    │
  ┌──────────────┐       │                                                 │
  │ Staff Web    │ HTTPS │  ┌─────────────────────┐                        │
  │ Portal       ├───────┼─►│ Azure Static Web    │                        │
  │ (Browser)    │       │  │ Apps / App Service  │                        │
  └──────┬───────┘       │  └─────────────────────┘                        │
         │               │                                                 │
         │ HTTPS REST    │  ┌─────────────────────┐  ┌──────────────────┐  │
         │ + OAuth2 ─────┼─►│ Azure App Service   │  │ Microsoft Entra  │  │
         │               │  │ (Backend API)       ├─►│ ID (Azure AD)    │  │
  ┌──────┴───────┐       │  │                     │  │ (SSO / Auth)     │  │
  │ iPad Kiosk   │ HTTPS │  │  Docker container   │  └──────────────────┘  │
  │ Devices      ├───────┼─►│  Node.js / Express  │                        │
  └──────┬───────┘       │  │                     │  ┌──────────────────┐  │
         │               │  │                     ├─►│ Azure Database   │  │
         │               │  │                     │  │ for PostgreSQL   │  │
         │ WebSocket     │  │                     │  └──────────────────┘  │
         └───────────────┼──┤                     │                        │
  ┌──────────────┐       │  │                     │  ┌──────────────────┐  │
  │ Staff Web    │ WSS   │  │                     ├─►│ Azure Key Vault  │  │
  │ Portal       ├───────┼─►│ Azure SignalR       │  │ (Secrets)        │  │
  └──────────────┘       │  │ Service             │  └──────────────────┘  │
                         │  │ (WebSocket Hub)     │                        │
                         │  │                     │  ┌──────────────────┐  │
                         │  └─────────────────────┘  │ Application      │  │
                         │                           │ Insights         │  │
                         │                           │ (Monitoring)     │  │
                         │                           └──────────────────┘  │
                         └─────────────────────────────────────────────────┘
```
