# Real-Time Ticketing System Backend

A comprehensive Node.js/TypeScript backend for managing real-time ticketing and case management with device integration, WebSocket support, and Azure AD authentication.

## 🚀 Features

- **Real-time Case Management**: Create, assign, and resolve student support cases
- **Device Integration**: Support for kiosk devices with pairing and status management
- **WebSocket Communication**: Real-time updates using Socket.IO
- **Azure AD Authentication**: Secure SSO integration with Microsoft Azure
- **Feedback System**: Collect and manage student feedback
- **Excel Export**: Export case data in multiple formats
- **Role-based Access Control**: Staff and admin roles with different permissions
- **Database Migrations**: Prisma-based database schema management

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

## 📚 API Documentation

The backend provides RESTful APIs organized into the following modules:

### Authentication (`/auth`)
- `GET /auth/login` - Initiate Azure AD login
- `GET /auth/callback` - Azure AD callback handler
- `POST /auth/logout` - Logout user
- `GET /auth/me` - Get current user info
- `POST /auth/refresh` - Refresh session

### Cases (`/cases`)
- `GET /cases/public-queue` - Get public queue (no auth)
- `GET /cases` - List cases with filters
- `POST /cases` - Create new case (device only)
- `POST /cases/take-next` - Take next available case
- `POST /cases/:id/take` - Take specific case
- `POST /cases/:id/resolve` - Resolve case
- `POST /cases/:id/escalate` - Escalate case

### Devices (`/device`)
- `GET /device` - List all devices
- `GET /device/by-mode/:mode` - Get devices by mode
- `GET /device/online/:mode` - Get online devices by mode
- `POST /device/heartbeat` - Device heartbeat (device auth)
- `GET /device/status` - Get device status (device auth)
- `POST /device/ws-token` - Get WebSocket token
- `PATCH /device/:id/mode` - Change device mode
- `PATCH /device/:id/name` - Update device name
- `DELETE /device/:id` - Unpair device

### Pairing (`/pair`)
- `POST /pair/generate-qr` - Generate QR code for pairing
- `POST /pair/complete` - Complete device pairing

### Feedback (`/feedback`)
- `POST /feedback/send` - Send feedback request to device
- `POST /feedback/submit` - Submit feedback (device auth)
- `POST /feedback/override` - Override feedback session

### Excel Export (`/excel`)
- `GET /excel/preview` - Get export preview/statistics
- `GET /excel/cases/json` - Export cases as JSON
- `GET /excel/cases/xlsx` - Export cases as Excel
- `GET /excel/cases` - Export cases (default Excel format)

### Health Check
- `GET /health` - Health check with connected devices count

For detailed API documentation, see [API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md).

## 🏗️ Architecture

### Project Structure
```
src/
├── server.ts              # Main application entry point
├── auth/                  # Azure AD authentication
├── controllers/           # Request handlers
├── services/             # Business logic
├── routers/              # Route definitions
├── middlewares/          # Express middlewares
├── websocket/            # WebSocket handlers
├── lib/                  # Utilities and database
└── error/                # Error handling

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

### Key Components

#### Database Models
- **Staff**: System users with roles (STAFF/ADMIN)
- **StudentCase**: Support cases with status tracking
- **KioskDevice**: Physical devices that can be paired
- **Feedback**: Student feedback on resolved cases
- **Session**: User authentication sessions
- **KioskLock**: Device reservation system

#### Authentication Flow
1. Azure AD SSO integration
2. Session-based authentication using cookies
3. Role-based access control (Staff/Admin)
4. Device authentication using secrets

#### WebSocket Integration
- Real-time updates for case status changes
- Device connection management
- Lease-based device locking system

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

## 📖 Additional Documentation

- [API Documentation](docs/API_DOCUMENTATION.md)
- [Database Schema](docs/DATABASE_SCHEMA.md)
- [WebSocket Protocol](docs/WEBSOCKET_PROTOCOL.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
