# Business Requirements 


## Table of Contents

1. [Purpose and Scope](#1-purpose-and-scope)
2. [Business Context](#2-business-context)
3. [Stakeholders and Actors](#3-stakeholders-and-actors)
4. [Business Objectives](#4-business-objectives)
5. [Functional Requirements](#5-functional-requirements)
6. [Non-Functional Requirements](#6-non-functional-requirements)
7. [Business Rules and Constraints](#7-business-rules-and-constraints)
8. [Out of Scope](#8-out-of-scope)
9. [Assumptions and Dependencies](#9-assumptions-and-dependencies)
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

### 3.1 Primary Actors

| Actor | Description | Primary Interaction |
|-------|-------------|---------------------|
| **Student** | University student seeking help desk assistance | iPad Kiosk App |
| **Frontdesk Staff** | Help desk employee serving students | Staff Web Portal |
| **Manager / Admin** | Supervisor responsible for service quality and staffing | Staff Web Portal (Admin role) |

### 3.2 Secondary Actors

| Actor | Description | Primary Interaction |
|-------|-------------|---------------------|
| **iPad Device (Registration mode)** | Physical iPad used by students to enter their details | Kiosk App |
| **iPad Device (Feedback mode)** | Physical iPad used by students to rate their experience | Kiosk App |
| **Public Display Screen** | Monitor showing the live queue | Public Display Web Page |
| **System Administrator** | Manages device pairing, staff access, and system configuration | Staff Web Portal |

---

## 4. Business Objectives

| ID | Objective | Measure of Success |
|----|-----------|-------------------|
| BO-01 | Eliminate informal queue management with a structured digital queue | All student walk-ins are registered through the system |
| BO-02 | Provide staff with a shared, real-time view of the queue | Staff take cases from a single live queue visible to all |
| BO-03 | Capture structured student feedback for every resolved case | Feedback submission rate and rating data available per case |
| BO-04 | Enable management to report on service performance | Admin can export case and feedback data to Excel |
| BO-05 | Reduce device management overhead for kiosk iPads | iPads are paired, monitored, and managed centrally from the staff portal |
| BO-06 | Ensure secure access for staff using existing university identity | Login via Microsoft Azure AD SSO with no separate credentials required |

---

## 5. Functional Requirements

### 5.1 Student Self-Registration (iPad Kiosk — Registration Mode)

| ID | Requirement |
|----|-------------|
| FR-01 | The system shall allow a student to register a help request by entering their name, student ID (zID), and selecting a problem category on a Registration-mode iPad |
| FR-02 | Upon submission, the system shall create a case with status QUEUED and display confirmation to the student |
| FR-03 | The system shall display the student's position in the queue on the public display screen after registration |
| FR-04 | The Registration iPad shall remain in a persistent kiosk state, ready for the next student after each submission |

### 5.2 Queue Management (Staff Web Portal)

| ID | Requirement |
|----|-------------|
| FR-05 | The system shall present all queued cases to staff in FIFO order based on registration time |
| FR-06 | The system shall allow a staff member to take the next available case from the queue in a single action |
| FR-07 | The system shall allow a staff member to take a specific case by selecting it from the queue |
| FR-08 | When a case is taken, the system shall assign it to that staff member and update its status to IN_PROGRESS in real time across all connected dashboards |
| FR-09 | The system shall prevent two staff members from simultaneously taking the same case |
| FR-10 | The system shall display a staff member's own active case(s) separately from the general queue |

### 5.3 Case Handling (Staff Web Portal)

| ID | Requirement |
|----|-------------|
| FR-11 | The system shall allow a staff member to resolve a case they own, updating its status to RESOLVED_PENDING_FEEDBACK |
| FR-12 | The system shall allow a staff member to escalate a case to a nominated department when it cannot be resolved at the frontdesk |
| FR-13 | The system shall record whether a case was resolved on-site or escalated |
| FR-14 | The system shall record timestamps for case creation, when a staff member started the case, and when it was resolved |

### 5.4 Feedback Collection (iPad Kiosk — Feedback Mode)

| ID | Requirement |
|----|-------------|
| FR-15 | After resolving a case, the system shall allow a staff member to send a feedback request to a selected Feedback-mode iPad |
| FR-16 | The selected iPad shall automatically display the feedback screen in real time upon receiving the request |
| FR-17 | The system shall allow the student to submit a star rating (1–5) and an optional written comment |
| FR-18 | Upon feedback submission, the system shall update the case status to RESOLVED and notify the staff dashboard |
| FR-19 | The system shall allow a staff member to override a pending feedback session if the student has left without providing feedback |
| FR-20 | A Feedback-mode iPad shall only serve one feedback session at a time; the system shall prevent concurrent sessions on the same device |

### 5.5 Public Queue Display

| ID | Requirement |
|----|-------------|
| FR-21 | The system shall provide a public-facing display screen showing all currently QUEUED cases in order |
| FR-22 | The public display shall update in real time as cases are added or taken |
| FR-23 | The public display shall not require authentication to view |
| FR-24 | The public display shall show student name and their position number in the queue |

### 5.6 Device Management (Staff Web Portal — Admin)

| ID | Requirement |
|----|-------------|
| FR-25 | The system shall allow an administrator to pair a new iPad by generating a QR code that the iPad scans to register itself |
| FR-26 | The system shall allow an administrator to set or change the mode of a registered iPad (REGISTRATION or FEEDBACK) |
| FR-27 | The system shall allow an administrator to rename a registered iPad |
| FR-28 | The system shall allow an administrator to unpair (remove) a registered iPad |
| FR-29 | The system shall display the online/offline status of all registered iPads in real time |
| FR-30 | The system shall mark an iPad as offline if it has not sent a heartbeat within a defined interval |

### 5.7 Authentication and Access Control (Staff Web Portal)

| ID | Requirement |
|----|-------------|
| FR-31 | Staff shall authenticate using their existing university Microsoft account via Azure AD Single Sign-On (SSO) |
| FR-32 | The system shall support two staff roles: STAFF and ADMIN |
| FR-33 | STAFF role users shall be able to view the queue, take cases, resolve cases, and send feedback requests |
| FR-34 | ADMIN role users shall have all STAFF permissions plus device management, data export, and user administration |
| FR-35 | The system shall automatically create or update a staff account upon first successful SSO login |
| FR-36 | The system shall maintain authenticated sessions with automatic token refresh, requiring re-authentication after session expiry |

### 5.8 Reporting and Data Export (Staff Web Portal — Admin)

| ID | Requirement |
|----|-------------|
| FR-37 | The system shall allow an administrator to export all case data — including category, timestamps, assigned staff, escalation status, and feedback ratings — to an Excel (.xlsx) file |
| FR-38 | The system shall provide a preview of export data before download |
| FR-39 | The exported data shall support management decisions on staffing levels and service quality |

---

## 6. Non-Functional Requirements

### 6.1 Performance

| ID | Requirement |
|----|-------------|
| NFR-01 | Real-time events (case status changes, feedback requests) shall be delivered to connected clients within 2 seconds under normal load |
| NFR-02 | Case submission from the Registration iPad shall complete within 3 seconds under normal network conditions |
| NFR-03 | The staff dashboard shall load the current queue within 3 seconds on initial page load |

### 6.2 Availability and Reliability

| ID | Requirement |
|----|-------------|
| NFR-04 | The system shall be available during all help desk operating hours |
| NFR-05 | iPad devices shall automatically reconnect to the backend if the connection is interrupted, without requiring manual intervention |
| NFR-06 | If a feedback session lease expires before the student submits feedback, the system shall automatically release the device lock |

### 6.3 Security

| ID | Requirement |
|----|-------------|
| NFR-07 | Staff access shall be controlled exclusively through Azure AD SSO; no password-based login is permitted for staff accounts |
| NFR-08 | All API communications shall use HTTPS |
| NFR-09 | iPad devices shall authenticate using a device-specific secret; device credentials shall not be human-readable after initial pairing |
| NFR-10 | Refresh tokens shall be stored in HTTP-only cookies and shall not be accessible to client-side JavaScript |
| NFR-11 | The public queue display endpoint shall be accessible without authentication but shall expose only non-sensitive queue data (student name and position only) |

### 6.4 Usability

| ID | Requirement |
|----|-------------|
| NFR-12 | The Registration iPad interface shall be operable by any student without prior instruction in under 60 seconds |
| NFR-13 | The Feedback iPad interface shall present the rating screen automatically — the student shall not need to navigate to it |
| NFR-14 | The staff dashboard shall update in real time without requiring the user to manually refresh the page |

### 6.5 Maintainability

| ID | Requirement |
|----|-------------|
| NFR-15 | The system shall be containerised using Docker to support consistent deployment across environments |
| NFR-16 | All database schema changes shall be managed through versioned Prisma migrations |
| NFR-17 | The system shall expose a health check endpoint for infrastructure monitoring |

### 6.6 Scalability

| ID | Requirement |
|----|-------------|
| NFR-18 | The system shall support multiple iPads operating in both Registration and Feedback modes simultaneously |
| NFR-19 | The system shall support multiple staff members viewing and working the queue concurrently |

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
| BR-07 | Only ADMIN users may pair, rename, change the mode of, or unpair devices |
| BR-08 | Only ADMIN users may export case data |
| BR-09 | Device pairing tokens expire and are single-use; a QR code cannot be reused |
| BR-10 | Feedback session leases have a time limit; if not completed within the lease window, the device is automatically released |
| BR-11 | Staff accounts are provisioned from Azure AD identity claims; the system does not create standalone staff accounts outside of SSO |

---

## 8. Out of Scope

The following items are explicitly outside the scope of this system:

| Item | Rationale |
|------|-----------|
| Appointment scheduling or pre-booked time slots | The system handles walk-in queues only |
| Student-facing notifications (email, SMS) | Students interact only via the on-site iPad kiosk |
| Integration with external student information systems (e.g., SIS or LMS) | Student data is entered manually at the kiosk |
| Multi-location / multi-campus queue management | The system is designed for a single help desk location |
| Staff scheduling or shift management | Staffing decisions are made by managers using exported reports |
| Chat or messaging between students and staff | All interaction is in-person at the desk |
| Case SLA enforcement or automated escalation | Escalation is a manual staff action |
| Payment or fee processing | Not applicable to this help desk context |

---

## 9. Assumptions and Dependencies

### 9.1 Assumptions

| ID | Assumption |
|----|------------|
| A-01 | All students have a valid university zID |
| A-02 | The help desk area has stable Wi-Fi connectivity for iPad operation |
| A-03 | All staff have an active university Microsoft account eligible for Azure AD SSO |
| A-04 | iPads used as kiosks are managed devices (e.g., enrolled in MDM) and run in a locked-down kiosk mode |
| A-05 | At least one ADMIN account is provisioned manually for initial system setup |
| A-06 | The public display screen runs a standard web browser connected to the help desk network |

### 9.2 External Dependencies

| Dependency | Purpose |
|------------|---------|
| Microsoft Azure Active Directory | Staff authentication and SSO |
| Azure SignalR Service | Real-time event delivery to dashboards and iPad devices |
| PostgreSQL database | Persistent data storage |
| Apple App Store / MDM distribution | iPad application deployment and update |
| University network / Wi-Fi infrastructure | Connectivity for all client devices |

---
