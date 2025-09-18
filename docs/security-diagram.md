# System Security Architecture

This document provides a comprehensive security diagram of the Real-Time Ticketing System based on the actual implementation in the codebase.

## Security Flow Diagram

```mermaid
graph TB
    %% External Entities
    Staff[👤 Staff User Browser]
    Device[📱 Device iPad/Kiosk]
    Frontend[🖥️ Frontend Next.js]
    
    %% External Services
    AzureAD[🔐 Azure AD OAuth Provider]

    %% Backend Components
    subgraph Backend["Backend Server (Express.js)"]
        Server[🌐 Express Server server.ts]
        
        %% Security Middleware Layer
        subgraph SecurityMid["Security Middleware Chain"]
            Helmet[🛡️ Helmet Security Headers]
            CORS[🔄 CORS Cross-Origin Control]
            Session[🍪 Cookie Session Signed not encrypted]
            AzureAuth[🔐 Azure Auth azure-auth.middleware.ts]
            AuthMid[🔑 Auth Middleware auth.middleware.ts]
        end
        
        %% Router Layer
        subgraph RouterLayer["Router Layer"]
            AuthRouter[🔐 Auth Router SSO and Dev Login]
            CasesRouter[📋 Cases Router Public and Staff endpoints]
            DeviceRouter[📱 Device Router Device and Staff endpoints]
            PairRouter[🔗 Pair Router Public and Staff endpoints]
            FeedbackRouter[📝 Feedback Router Staff Only]
            ExcelRouter[📊 Excel Router Admin Only exports]
        end
        
        %% WebSocket Layer
        subgraph WSGateway["WebSocket Gateway"]
            WSOrigin[🌍 Origin Check FRONTEND_URL plus mobile origins]
            WSAuth[🔐 WS Auth websocket/auth.ts Verify device tokens]
            DeviceGateway[📡 Device Gateway Real-time Communication]
        end
        
        %% Services & Database
        subgraph BackendServices["Backend Services"]
            Services[⚙️ Business Services Cases Device Feedback]
            Prisma[🗄️ Prisma ORM Database Layer]
        end
    end
    
    %% Database
    DB[(🗄️ PostgreSQL Database)]
    
    %% Staff Authentication Flow
    Staff -->|1. Login Request| Frontend
    Frontend -->|2. Redirect to /auth/login| AuthRouter
    AuthRouter -->|3. OAuth Redirect| AzureAD
    AzureAD -->|4. Authorization Code| AuthRouter
    AuthRouter -->|5. Token Exchange & Session| Session
    
    %% Staff Request Flow
    Frontend -->|API Requests with Session Cookie| Server
    Server --> Session
    Session --> Helmet
    Helmet --> CORS
    CORS -->|Route to Auth Middleware| AzureAuth
    AzureAuth -->|Staff Record Lookup Role Assignment| AuthMid
    AuthMid -->|RBAC Check STAFF/ADMIN| CasesRouter
    AuthMid -->|Role Validation| FeedbackRouter
    
    %% Device Authentication Flow
    Device -->|Device auth header| DeviceRouter
    DeviceRouter --> AuthMid
    AuthMid -->|SHA256 Hash Validation Timing-Safe Comparison| Services
    
    %% WebSocket Authentication
    Device -->|JWT Token Request| DeviceRouter
    DeviceRouter -->|Issue JWT 30-day expiry| WSAuth
    Device -->|WebSocket Connection JWT Bearer Token| DeviceGateway
    Frontend -->|WebSocket Connection no token| DeviceGateway
    DeviceGateway --> WSOrigin
    DeviceGateway --> WSAuth
    WSAuth -->|Device token verification| DeviceGateway
    
    %% Data Layer
    Services --> Prisma
    Prisma --> DB
    
    %% Security Annotations
    classDef security fill:#ff6b6b,stroke:#d63031,stroke-width:2px,color:#fff
    classDef auth fill:#74b9ff,stroke:#0984e3,stroke-width:2px,color:#fff
    classDef middleware fill:#fdcb6e,stroke:#e17055,stroke-width:2px,color:#000
    classDef external fill:#00b894,stroke:#00a085,stroke-width:2px,color:#fff
    
    class AzureAD,WSAuth,AuthMid security
    class AzureAuth,AuthRouter auth
    class Helmet,CORS,Session middleware
    class Staff,Device,Frontend external
```

## Security Components Breakdown

### 1. Authentication Systems

#### Azure AD OAuth 2.0 (Staff Authentication)
- **Implementation**: `azure-auth.middleware.ts`
- **Flow**: OAuth 2.0 Authorization Code Grant
- **Session Management**: Encrypted cookie sessions with 30-day expiry
- **Staff Record**: Auto-creation on first login with role assignment
- **Caching**: 5-minute TTL for staff record lookups

#### Device Authentication
- **Implementation**: `auth.middleware.ts`, `lib/utils/auth.ts`
- **Format**: `Device <deviceId>:<deviceSecret>`
- **Validation**: SHA256 hash comparison with timing-safe equality
- **Security**: Prevents timing attacks through `crypto.timingSafeEqual()`

#### WebSocket Authentication
- **Implementation**: `websocket/auth.ts` and `websocket/index.ts`
- **Token Type**: JWT with 30-day expiry (devices)
- **Dashboard**: Connections without token are treated as dashboard
- **Origin Policy**: Checked against `FRONTEND_URL` and common mobile origins; dev/test allowed
- **Payload**: Includes deviceId and mode for device tokens

### 2. Authorization & Access Control

#### Role-Based Access Control (RBAC)
```typescript
// Middleware chain for staff endpoints
requireAuth → requireTenant → attachReqUser → requireStaff/requireAdmin
```

- **Roles**: `STAFF`, `ADMIN`
- **Hierarchy**: ADMIN has all STAFF permissions
- **Enforcement**: Middleware-level validation before route handlers

#### Route Protection Patterns
- **Staff Routes**: `requireAuth + requireStaff`
- **Admin Routes**: `requireAuth + requireAdmin` (e.g., `/excel/*` exports)
- **Device Routes**: `requireDevice`
- **Public Routes**: `/cases/public-queue`, `/pair/complete`, `/device/pairing-status/:id`
- **Mixed Routes**: Device and staff endpoints co-exist under `/device`

### 3. Security Middleware Stack

#### 1. Helmet.js
- **Purpose**: Sets standard security headers (Helmet defaults)
- **Note**: No custom CSP configured in code

#### 2. CORS Policy
- **Origin**: Restricted to `FRONTEND_URL`
- **Credentials**: Enabled for cookie-based authentication
- **Methods**: Controlled per route requirements

#### 3. Session Security
- **Type**: Signed cookie sessions (not encrypted)
- **Keys**: Multiple signing keys for rotation via `SESSION_KEYS`
- **Settings**: HttpOnly, SameSite=Lax, Secure in production
- **Proxy Trust**: `app.set("trust proxy", 1)`

### 4. Security Features

#### Input Validation
- **Body Parsing**: Limited to 50MB with URL encoding
- **Parameter Validation**: Runtime checks in controllers; no centralized schema validation
- **SQL Injection**: Prevented through Prisma ORM parameterization

#### Error Handling
- **Custom Errors**: `AuthError`, `BadRequestError`
- **Information Disclosure**: Sanitized error responses
- **Logging**: Structured error logging without sensitive data

#### Development Security
- **Dev Login**: Bypass OAuth for development environment
- **Test Endpoints**: Mock authentication for testing
- **Environment Isolation**: Feature flags for dev/test/production

### 5. Data Protection

#### Database Security
- **ORM**: Prisma with type-safe queries
- **Connection**: Not specified in code; depends on connection string/TLS settings
- **Migrations**: Version-controlled schema changes

#### Session Protection
- **Integrity**: Signed (not encrypted) cookies; client-readable but tamper-proof
- **Rotation**: Multiple keys allow rotation without invalidating sessions
- **Expiry**: `maxAge` 30 days

## Security Validation Points

1. **Authentication Verification**
   - Azure AD token validation with nonce verification
   - Device secret validation with timing-safe comparison
   - JWT signature verification for WebSocket connections

2. **Authorization Checks**
   - Role-based access control at middleware level
   - Tenant validation for multi-tenant support
   - Resource-level permissions where applicable

3. **Session Management**
   - Signed cookie sessions (not encrypted)
   - Automatic session expiry and cleanup
   - Session invalidation on logout

4. **Input Security**
   - Request size limiting to prevent DoS
   - Type validation through TypeScript and runtime checks
   - SQL injection prevention through ORM

This security architecture ensures multi-layered protection with defense in depth, proper authentication and authorization controls, and secure communication channels throughout the system.