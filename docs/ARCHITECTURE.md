## System Context (Frontend ↔ Backend)

```mermaid
flowchart LR
  %% Actors & Apps
  userStudent[Student]
  userStaff[Staff]
  subgraph Frontend
    nextApp["Dashboard (Next.js)"]
    kioskApp["iPad Kiosk App"]
  end

  subgraph Backend
    api["Backend API (HTTP/REST)"]
    ws["WebSocket Gateway (Socket.IO)"]
    services["Business Services"]
    db[("PostgreSQL via Prisma")]
    auth["Auth (JWT/Azure AD)"]
  end

  %% Connections
  userStaff -->|Browser| nextApp
  userStudent --> kioskApp

  nextApp <-->|"HTTPS JSON"| api
  nextApp <-->|"WSS events"| ws
  kioskApp <-->|"HTTPS JSON"| api
  kioskApp <-->|"WSS events"| ws

  api --> services
  ws --> services
  services <--> db
  api -.-> auth
  ws -.-> auth
```

Notes
- Dashboard uses HTTPS for CRUD and subscribes to WSS for real-time updates.
- Kiosk app primarily uses WSS for real-time commands and status.

## Backend Containers & Components

```mermaid
flowchart TB
  subgraph Frontend["Frontend Applications"]
    subgraph Dashboard["Staff Dashboard"]
      NextJS["Next.js App"]
    end
    
    subgraph KioskApps["Kiosk Applications"]
      KioskApp["iPad Kiosk App"]
    end
  end

  subgraph NodeBackend["Node.js Backend"]
    subgraph WebSocket["WebSocket Layer"]
      wsAuth["WS Authentication (verifySocketHandshake)"]
      wsConnHandler["Connection Handler (connect/disconnect)"]
      wsMsgHandler["Message Event Handler (socket.on('message'))"]
      deviceGateway["Device Gateway (Outbound Messages)"]
    end

    subgraph Transport["Transport Layer"]
      httpSrv["HTTP Server (Express)"]
      wsSrv["WebSocket Server (Socket.IO)"]
      globalMW["Global Middleware"]
      subgraph GlobalMiddleware["Global Middleware Components"]
        cors["CORS & Security"]
        helmet["Helmet Security"]
        parser["Body/Cookie Parser"]
        session["Session Management"]
      end
    end

    subgraph API["API Layer"]
      subgraph Routes["HTTP Routes"]
        authRouter["Auth Router"]
        casesRouter["Cases Router"]
        deviceRouter["Device Router"]
        pairRouter["Pair Router"]
        feedbackRouter["Feedback Router"]
        excelRouter["Excel Router"]
      end
      
      subgraph RouteMiddleware["Route-Level Middleware"]
        authMW["Authentication (requireAuth)"]
        azureMW["Azure AD Auth"]
        staffMW["Staff Authorization"]
        deviceMW["Device Authentication"]
      end
      
      subgraph Controllers["Controllers"]
        casesCtrl["Cases Controller"]
        deviceCtrl["Device Controller"]
        pairCtrl["Pair Controller"]
        feedbackCtrl["Feedback Controller"]
        excelCtrl["Excel Controller"]
      end
    end

    subgraph Business["Business Logic Layer"]
      subgraph Services["Services"]
        casesService["Cases Service"]
        deviceService["Device Service"]
        pairService["Pair Service"]
        feedbackService["Feedback Service"]
        excelService["Excel Service"]
        cleanupService["Device Cleanup Service"]
      end
    end

    subgraph DataAccess["Data Access Layer"]
      prismaClient["Prisma Client"]
    end
  end

  subgraph Database["Database Layer"]
    postgres[("PostgreSQL")]
  end

  %% Frontend connections
  NextJS <--> httpSrv
  NextJS <--> wsSrv
  KioskApp <--> httpSrv
  KioskApp <--> wsSrv

  %% HTTP request flow (two-level middleware)
  httpSrv --> globalMW
  globalMW --> GlobalMiddleware
  globalMW --> Routes
  Routes --> RouteMiddleware
  RouteMiddleware --> Controllers

  %% WebSocket flow  
  wsSrv --> wsAuth
  wsAuth --> wsConnHandler
  wsConnHandler --> wsMsgHandler

  %% Business logic connections
  Controllers --> Services
  wsMsgHandler --> Services
  Services --> deviceGateway

  %% Data access
  Services --> prismaClient
  prismaClient --> postgres
```

Notes
- **Transport Layer**: Express HTTP server and Socket.IO WebSocket server with comprehensive middleware stack
- **API Layer**: RESTful HTTP routes and controllers for CRUD operations
- **WebSocket Layer**: Real-time communication handling for device management and notifications
- **Business Logic Layer**: Domain services containing core business logic and transaction management
- **Data Access Layer**: Prisma ORM providing type-safe database access
- **Database Layer**: PostgreSQL as the persistent data store

## Current Architecture Issues

1. **WebSocket Handler Direct Database Access**: The WebSocket handler (`src/websocket/index.ts`) currently contains direct Prisma operations, which violates layered architecture principles.

2. **Mixed Responsibilities**: Business logic is scattered between the WebSocket layer and Service layer, making the code harder to maintain and test.