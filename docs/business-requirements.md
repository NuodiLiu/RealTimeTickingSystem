# Business Requirements 


## Table of Contents

1. [Purpose and Scope](#1-purpose-and-scope)
2. [Business Context](#2-business-context)
3. [Stakeholders and Actors](#3-stakeholders-and-actors)
4. [Business Objectives](#4-business-objectives)
5. [Functional Requirements](#5-functional-requirements)
6. [Non-Functional Requirements](#6-non-functional-requirements)
7. [Business Rules and Constraints](#7-business-rules-and-constraints)
---

## 1. Purpose and Scope

### 1.1 Purpose

This system is a help desk platform to digitalise and streamline student walk-in enquiries. The system implements a queue management with a real-time, device-connected workflow covering student registration, case management, feedback collection, and management reporting.

### 1.2 Scope

The system encompasses:

- A **native iPad application** (kiosk) for student self-service registration and post-service feedback
- A **web-based staff portal** for queue management, case handling, and device administration
- A **public display screen** showing the live queue for students waiting in the help desk area
- A **backend API** supporting all client interactions with persistent data storage and real-time event delivery
- An **administrative interface** for data export and reporting

---

## 2. Business Context

The Student Service operates as a walk-in service centre where students seek assistance with a variety of academic, technical, and administrative enquiries. Prior to this system, no structured tracking of wait times, case categories, resolution rates, or student satisfaction was in place.

The system was introduced to:

- Provide a fair, visible, first-in-first-out queue for students
- Give staff a single shared view of all active and pending cases
- Capture structured feedback data after each interaction
- Enable management to make staffing and service decisions based on data

---

## 3. Stakeholders and Actors

| Actor | Description | Primary Interaction |
|-------|-------------|---------------------|
| **Student** | University student seeking help desk assistance | iPad Kiosk App |
| **Frontdesk Staff** | Help desk employee serving students | Staff Web Portal |
| **Manager / Admin** | Supervisor responsible for service quality, staffing, and system configuration | Staff Web Portal (Admin role) |

---

## 4. Business Objectives

| ID | Objective | Measure of Success |
|----|-----------|-------------------|
| BO-01 | Eliminate informal queue management with a structured digital queue | All student walk-ins are registered through the system |
| BO-02 | Provide staff with a shared, real-time view of the queue | Staff take cases from a single live queue visible to all |
| BO-03 | Capture structured student feedback for every resolved case | Feedback submission rate and rating data available per case |
| BO-04 | Enable management to report on service performance | Admin can export case and feedback data to Excel |
| BO-05 | Reduce device management overhead for kiosk iPads | iPads are paired, monitored, and managed centrally from the staff portal |

---

## 5. Functional Requirements

The following requirements define the capabilities the system must deliver.

### 5.1 Student Registration

| ID | Requirement |
|----|-------------|
| FR-01 | The system shall allow a student to register a help request by entering their name, zID, and selecting a problem category on a Registration-mode iPad |
| FR-02 | Upon submission, the system shall create a case with status QUEUED and confirm registration to the student |

### 5.2 Queue and Case Management

| ID | Requirement |
|----|-------------|
| FR-03 | The system shall present all queued cases to staff in FIFO order and allow a staff member to take the next case or a specific case; the case status shall update to IN_PROGRESS in real time across all connected dashboards |
| FR-04 | The system shall prevent two staff members from simultaneously claiming the same case |
| FR-05 | A staff member shall be able to resolve a case (advancing it to RESOLVED_PENDING_FEEDBACK) or escalate it to a nominated external department |

### 5.3 Feedback Collection

| ID | Requirement |
|----|-------------|
| FR-06 | After resolving a case, a staff member shall be able to send a feedback request to a selected Feedback-mode iPad; the iPad shall display the feedback screen automatically in real time without any student interaction |
| FR-07 | The student shall be able to submit a star rating (1–5) and an optional comment; on submission the case shall move to RESOLVED and the staff dashboard shall be notified |
| FR-08 | A staff member shall be able to override an active feedback session to release the device; the system shall prevent more than one concurrent feedback session on the same device at any time |

### 5.4 Public Queue Display

| ID | Requirement |
|----|-------------|
| FR-09 | The system shall provide an unauthenticated public display screen showing the live QUEUED list — student name and queue position — updating in real time as cases are added or taken |

### 5.5 Device Management

| ID | Requirement |
|----|-------------|
| FR-10 | An administrator shall be able to pair a new iPad via a one-time QR code, assign or change its mode (REGISTRATION or FEEDBACK), and unpair it |
| FR-11 | The system shall track and display the real-time online/offline status of all registered devices |

### 5.6 Authentication and Access Control

| ID | Requirement |
|----|-------------|
| FR-12 | Staff shall authenticate exclusively via Azure AD Single Sign-On using their university Microsoft account; no password-based login shall be permitted |
| FR-13 | The system shall enforce two roles — STAFF (queue, case, and feedback operations) and ADMIN (all STAFF permissions plus device management and data export) — with access control enforced server-side on every request |

### 5.7 Reporting

| ID | Requirement |
|----|-------------|
| FR-14 | An administrator shall be able to export all case data — including category, timestamps, assigned staff, escalation status, and feedback ratings — to an Excel (.xlsx) file |

---

## 6. Non-Functional Requirements

### 6.1 Performance

Performance requirements are critical because the system operates in a live, in-person service environment. Delays directly impact the student experience and staff efficiency.

| ID | Requirement |
|----|-------------|
| NFR-01 | Real-time events shall be delivered to all connected clients within **2 seconds** under normal operating load |
| NFR-02 | Case submission from the Registration iPad shall complete end-to-end within **3 seconds** under normal network conditions |
| NFR-03 | The staff dashboard shall render the current queue within **3 seconds** on initial page load |
| NFR-04 | The system shall sustain these response targets with at least **10 concurrent iPad devices** and **5 concurrent staff dashboard sessions** active simultaneously |

### 6.2 Security

The system processes student personal data (name, student ID) and is accessed by university staff using institutional credentials. All controls are enforced at the server side regardless of client behaviour.

| ID | Requirement |
|----|-------------|
| NFR-05 | All API and WebSocket communications shall use **HTTPS / TLS 1.2 or higher**; plaintext HTTP shall not be accepted |
| NFR-06 | Staff authentication shall be controlled **exclusively through Azure AD SSO**; no password-based login, shared credentials, or local account creation shall be permitted |
| NFR-07 | App JWTs issued to staff shall have a maximum lifetime of **2 hours**; refresh tokens shall be stored in **HTTP-only, Secure, SameSite cookies** and shall never be accessible to client-side JavaScript |
| NFR-08 | Device credentials shall be **hashed using a one-way function** at the time of pairing; the raw device secret shall not be stored or logged anywhere in the system after pairing completes |
| NFR-09 | **Role-based access control** shall be enforced server-side on every API request; no client-supplied role claim shall be trusted without server validation |
| NFR-10 | Device pairing tokens shall be **single-use and time-limited**; a QR code that has been scanned or has expired shall be rejected |
| NFR-11 | The public queue display endpoint shall be the **only unauthenticated endpoint**; it shall expose student name and queue position only|
| NFR-12 | All system endpoints shall be **restricted to the university network** via IP allowlisting |

### 6.3 Availability and Reliability

| ID | Requirement |
|----|-------------|
| NFR-13 | The system shall be available during all help desk operating hours |
| NFR-14 | iPad devices shall automatically reconnect to the real-time service if the connection is interrupted, without requiring staff or student intervention |
| NFR-15 | If a feedback session lease expires before feedback is submitted, the system shall automatically release the device lock so the device becomes available for the next session |

### 6.4 Maintainability

| ID | Requirement |
|----|-------------|
| NFR-16 | The system shall be containerised using Docker to ensure consistent, reproducible deployments across development and production environments |
| NFR-17 | All database schema changes shall be managed through versioned migrations to support auditable, reversible schema evolution |
| NFR-18 | The system shall expose a health check endpoint to enable infrastructure monitoring and automated restart on failure |

---

## 7. Business Rules and Constraints

| ID | Rule |
|----|------|
| BR-01 | Cases are served in strict FIFO order; a staff member taking the "next" case always takes the oldest QUEUED case |
| BR-02 | A case can only be assigned to one staff member at a time |
| BR-03 | A Feedback-mode iPad can only be locked to one feedback session at a time; a second request cannot target the same device while it is busy |
| BR-04 | Feedback can only be submitted once per case |
| BR-05 | A case cannot return to QUEUED status once it has been taken by a staff member |
| BR-06 | Resolving a case moves it to RESOLVED_PENDING_FEEDBACK, not directly to RESOLVED; RESOLVED requires feedback submission or an override |
| BR-07 | Feedback session leases have a time limit; if not completed within the lease window, the device is automatically released |

---
