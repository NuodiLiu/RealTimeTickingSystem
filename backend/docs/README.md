# Real-Time Ticketing System Backend

A comprehensive Node.js/TypeScript backend for managing real-time ticketing and case management with device integration, WebSocket support, and Azure AD authentication.

## 🚀 Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js 5.1.0
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Azure AD OAuth + session cookies
- **Real-time**: Socket.IO WebSocket server
- **File Processing**: XLSX for Excel exports
- **API Docs**: Swagger/OpenAPI 3.0

## ✨ Key Features

- **🔐 Authentication**: Azure AD OAuth with role-based access (STAFF, ADMIN, SUPER_ADMIN)
- **📋 Case Management**: FIFO queue system with position tracking and escalation
- **🖥️ Device Management**: Secure iPad pairing with QR codes and status monitoring
- **💬 Feedback System**: Device-locked feedback collection with override support
- **⚡ Real-time Updates**: WebSocket-based live updates for all clients
- **📊 Excel Export**: Export case data in multiple formats
- **🔧 Database Migrations**: Prisma-based schema management

## 📋 Prerequisites

- Node.js (v18 or higher)
- PostgreSQL database
- Azure AD application (for SSO)
- npm or yarn package manager

## 🛠️ Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables (see [Environment Configuration](#environment-configuration))

4. Set up the database:
```bash
npx prisma generate
npx prisma migrate deploy
```

5. (Optional) Seed the database:
```bash
npx ts-node prisma/seed.ts
```

## 🔧 Environment Configuration

Create a `.env` file in the root directory with the following variables:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/ticketing_db"

# Server
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:3001

# Session
SESSION_KEYS=your-secret-key-1,your-secret-key-2

# Azure AD Authentication
AZURE_CLIENT_ID=your-azure-client-id
AZURE_CLIENT_SECRET=your-azure-client-secret
AZURE_TENANT_ID=your-azure-tenant-id
AZURE_REDIRECT_URI=http://localhost:3000/auth/callback

# JWT
JWT_SECRET=your-jwt-secret
```

See [.env.example](.env.example) for a complete template.

## 🏃‍♂️ Running the Application

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm run build
npm start
```

### Testing
```bash
npm test
```

## � API Endpoints

### Authentication (`/auth`)
```
GET  /auth/login     # Redirect to Azure AD
GET  /auth/callback  # OAuth callback handler
POST /auth/logout    # Clear session
GET  /auth/me        # Get current user
POST /auth/refresh   # Refresh session
```

### Cases (`/cases`)
```
GET  /cases/public-queue    # Public queue (no auth)
GET  /cases/queue           # Get queued cases
POST /cases                 # Create new case
GET  /cases/my-active       # Get staff's active cases
POST /cases/:id/take        # Take case from queue
POST /cases/take-next       # Take next available case
POST /cases/:id/resolve     # Mark case as resolved
POST /cases/:id/escalate    # Escalate case
```

### Devices (`/device`)
```
GET  /device                # List all devices
GET  /device/by-mode/:mode  # Get devices by mode
GET  /device/online/:mode   # Get online devices by mode
POST /device/heartbeat      # Device status ping
GET  /device/status         # Get device status
GET  /device/ws-token       # Get WebSocket auth token
PATCH /device/:id/mode      # Change device mode
PATCH /device/:id/name      # Update device name
DELETE /device/:id          # Unpair device
```

### Pairing (`/pair`)
```
POST /pair/generate-qr      # Generate QR code for pairing
POST /pair/complete         # Complete device pairing
```

### Feedback (`/feedback`)
```
POST /feedback/send         # Request feedback from device
POST /feedback/submit       # Submit feedback (device)
POST /feedback/override     # Override busy device
```

### Export (`/excel`)
```
GET  /excel/preview         # Export preview/statistics
GET  /excel/cases/json      # Export cases as JSON
GET  /excel/cases/xlsx      # Export cases as Excel
GET  /excel/cases           # Export cases (default Excel)
```

## ⚡ WebSocket Protocol

### Connection
```typescript
// Staff connection (browser)
io('ws://localhost:3000/ws', { 
  withCredentials: true 
})

// Device connection (kiosk)
io('ws://localhost:3000/ws', {
  auth: { token: 'device_jwt_token' }
})
```

### Events
```typescript
// Server → Clients
'event' -> {
  type: 'case:created' | 'case:updated' | 'device:status' | 'case:feedback_ready'
  payload: object
}
'case:queue_updated' -> UpdatedCase[]
'device:status_changed' -> { deviceId, status, lastSeenAt }

// Clients → Server
'device:heartbeat' -> { deviceId }
'device:register' -> { secret }
'feedback:status' -> { sessionId, status }
```

## 🔒 Authentication Flows

### Staff Login
1. User visits `/auth/login`
2. Redirect to Azure AD OAuth
3. Azure returns to `/auth/callback`
4. Create session cookie
5. Redirect to dashboard

### Device Authentication
1. Device pairs via QR code
2. Receives device secret
3. Exchanges secret for JWT token via `/device/ws-token`
4. Uses JWT for WebSocket auth

## 🛡️ Security Features

- **Azure AD Integration**: Enterprise-grade authentication
- **Session Management**: Secure cookie-based sessions  
- **Role-based Access**: Staff and admin permission levels
- **Device Authentication**: Secret-based device pairing
- **Input Validation**: Request validation and sanitization
- **CORS Protection**: Configurable cross-origin policies
- **Helmet.js**: Security headers and protections

## 🏗️ Business Logic

### Queue Management
- Auto-assigns position numbers sequentially
- Maintains queue order with database constraints
- Updates positions when cases are taken/resolved

### Device Locking
- Prevents concurrent feedback sessions
- Uses optimistic locking with version numbers
- Supports override functionality for staff

### Real-time Updates
- Debounced updates to prevent spam
- Selective broadcasting based on event type
- Connection management for device heartbeats

## 🏗️ Project Structure

```
src/
├── server.ts              # Application entry point
├── controllers/           # Route handlers and business logic
├── services/             # Core business logic and database operations
├── middlewares/          # Authentication, error handling
├── routers/              # Express route definitions
├── websocket/            # Socket.IO event handlers
├── auth/                 # Azure AD integration
├── lib/                  # Database connection and utilities
├── error/                # Custom error classes
└── server.ts             # Application entry point

prisma/
├── schema.prisma         # Database schema
├── migrations/           # Database migrations
└── seed.ts              # Database seeding

tests/                    # Test files
├── cases/               # Case-related tests
├── device/              # Device-related tests
├── feedback/            # Feedback tests
├── integration/         # Integration tests
└── websocket/           # WebSocket tests
```

## 📊 Database Schema

### Core Models

```typescript
// Staff users
Staff {
  id: string
  employeeNo: string
  name: string
  email: string
  role: StaffRole
  identityKey: string // Azure AD identifier
}

// Support cases
Case {
  id: string
  studentName: string
  studentId: string
  email: string
  issue: string
  status: CaseStatus
  assignedStaffId?: string
  position?: number
  escalatedTo?: EscalationType
}

// iPad devices
Device {
  id: string
  name: string
  secret: string
  mode: DeviceMode
  status: DeviceStatus
  lastSeenAt: DateTime
  currentLockId?: string
}

// Feedback sessions
FeedbackSession {
  id: string
  caseId: string
  deviceId: string
  status: FeedbackStatus
  rating?: number
  comment?: string
}
```

### Status Enums
```typescript
CaseStatus: QUEUED | IN_PROGRESS | RESOLVED | RESOLVED_PENDING_FEEDBACK
DeviceMode: DUAL | FEEDBACK_ONLY
DeviceStatus: ONLINE | OFFLINE
StaffRole: STAFF | ADMIN | SUPER_ADMIN
FeedbackStatus: CREATED | DELIVERED | COMPLETED | CANCELLED
```

## 🧪 Testing

The project includes comprehensive tests covering:

- Unit tests for controllers and services
- Integration tests for API endpoints
- WebSocket connection and message tests
- Device pairing and authentication tests

Run specific test suites:
```bash
# Run all tests
npm test

# Run specific test files
npm test -- tests/cases/postCase.test.ts
npm test -- tests/device/device.status.test.ts
```

## 📦 Database Management

### Migrations
```bash
# Generate new migration
npx prisma migrate dev --name migration_name

# Apply migrations
npx prisma migrate deploy

# Reset database (development only)
npx prisma migrate reset
```

### Schema Updates
```bash
# Generate Prisma client after schema changes
npx prisma generate

# View database in Prisma Studio
npx prisma studio
```

## 🔒 Security Features

- **Azure AD Integration**: Enterprise-grade authentication
- **Session Management**: Secure cookie-based sessions
- **Role-based Access**: Staff and admin permission levels
- **Device Authentication**: Secret-based device pairing
- **Input Validation**: Request validation and sanitization
- **CORS Protection**: Configurable cross-origin policies
- **Helmet.js**: Security headers and protections

## 🚀 Deployment

### Environment Setup
1. Set `NODE_ENV=production`
2. Configure production database
3. Set up Azure AD production app
4. Configure session secrets
5. Set up SSL certificates

### Production Considerations
- Use a production-grade database (PostgreSQL)
- Set up proper logging and monitoring
- Configure load balancing for WebSocket connections
- Set up automated backups
- Monitor performance and error rates

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite
6. Submit a pull request

## 📝 License

This project is licensed under the ISC License.

## 🆘 Support

For questions or support, please contact the development team or create an issue in the repository.

## 📖 API Documentation

- **Swagger UI**: http://localhost:3000/api-docs
- **OpenAPI Spec**: Available in `/docs/api.yaml`

---