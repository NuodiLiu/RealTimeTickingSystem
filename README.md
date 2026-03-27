# Real-Time Ticketing System

A real-time ticketing platform for managing student help requests. The system consists of three components: a **web-based staff dashboard** (frontend), a **Node.js backend server**, and a **native iPad kiosk app** available on TestFlight.

## System Overview

### 1. Frontend — Staff Dashboard (`/frontend`)

A [Next.js](https://nextjs.org) web application that provides the staff-facing interface for managing incoming help requests. Staff can:

- View and manage the live ticketing queue in real time
- Claim, resolve, and export tickets
- Monitor connected iPad kiosk devices
- Pair new iPad devices via QR code
- Access a public display view for queue status

### 2. Backend — API & WebSocket Server (`/backend`)

A Node.js/Express server that serves as the central hub for the entire system. It handles:

- **REST API** for ticket submission, device pairing, feedback, and authentication
- **WebSocket (SignalR)** for real-time push updates to the dashboard and iPad devices
- **Database** access via Prisma ORM
- **Excel export** of ticket records
- **Authentication** with JWT tokens and device secrets

### 3. KioskApp — iPad Client (`/KioskApp`)

A native SwiftUI iPad application available on **[TestFlight](https://testflight.apple.com)** that serves as the student-facing kiosk. Students can:

- Submit help requests (name, student ID, issue category and description)
- Receive real-time status updates via WebSocket
- Provide feedback after their case is resolved

Devices are registered to the system by scanning a QR code from the staff dashboard.

## Architecture

```
┌─────────────────────┐        ┌──────────────────────┐
│   Staff Dashboard   │        │    iPad Kiosk App     │
│   (Next.js / Web)   │        │  (SwiftUI / iOS)      │
└────────┬────────────┘        └──────────┬────────────┘
         │  REST + WebSocket              │  REST + WebSocket
         └──────────────┬─────────────────┘
                        │
               ┌────────▼────────┐
               │  Backend Server │
               │ (Node/Express)  │
               └────────┬────────┘
                        │
               ┌────────▼────────┐
               │    Database     │
               │    (Prisma)     │
               └─────────────────┘
```

## Getting Started

See the README in each subdirectory for setup and development instructions:

- [`/frontend/README.md`](./frontend/README.md) — Web dashboard setup
- [`/backend`](./backend) — Backend server setup
- [`/KioskApp/README.md`](./KioskApp/README.md) — iPad app setup
