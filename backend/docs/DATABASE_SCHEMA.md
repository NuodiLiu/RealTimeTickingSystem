# Database Schema Documentation

Describes the database schema for the system including all tables, relationships, and key constraints.

## Overview

Uses PostgreSQL as the primary database with Prisma as the ORM. The schema is designed to support:

- User authentication and authorization
- Case management and tracking
- Device pairing and management  
- Feedback collection
- Real-time WebSocket connections
- Session management

## Database Models

### Staff

Represents system users

```prisma
model Staff {
  id               String            @id @default(cuid())
  employeeNo       String            @unique
  name             String
  email            String            @unique
  password         String
  role             StaffRole         @default(STAFF)
  identityKey      String            @unique
  createdAt        DateTime          @default(now())
  // ... relationships
}
```

**Key Fields:**
- `id`: Primary identifier (CUID)
- `employeeNo`: Unique employee number
- `email`: Unique email address
- `role`: STAFF or ADMIN role
- `identityKey`: Unique identifier for Azure AD integration
- `password`: Hashed password (may be empty for SSO-only users)

**Relationships:**
- One-to-many with `StudentCase` (assigned cases)
- One-to-many with `Feedback` (feedback received)
- One-to-many with `Session` (authentication sessions)
- One-to-many with `KioskLock` (device locks)
- One-to-one with `IdpAccount` (identity provider account)

### StudentCase

Represents support cases submitted by students.

```prisma
model StudentCase {
  id               String            @id @default(cuid())
  zID              String
  studentName      String
  category         String
  status           CaseStatus        @default(QUEUED)
  staffId          String?
  escalatedTo      String?
  resolvedOnSite   Boolean?
  createdAt        DateTime          @default(now())
  resolvedAt       DateTime?
  startedAt        DateTime?
  // ... relationships
}
```

**Key Fields:**
- `id`: Primary identifier
- `zID`: Student ID number
- `studentName`: Full name of the student
- `category`: Type of support request
- `status`: Current case status (QUEUED, IN_PROGRESS, RESOLVED_PENDING_FEEDBACK, RESOLVED)
- `staffId`: Assigned staff member (nullable)
- `escalatedTo`: Staff member case was escalated to (nullable)
- `startedAt`: When case was first taken by staff
- `resolvedAt`: When case was marked as resolved

**Indexes:**
- `(status, createdAt)`: For efficient queue queries
- `(staffId)`: For staff workload queries

### KioskDevice

Represents physical kiosk devices that can be paired with the system.

```prisma
model KioskDevice {
  id               String            @id @default(cuid())
  name             String
  secretHash       String
  mode             DeviceMode        @default(REGISTRATION)
  lastSeenAt       DateTime          @default(now())
  deletedAt        DateTime?
  currentLockId    String?           @unique
  // ... relationships
}
```

**Key Fields:**
- `id`: Primary identifier
- `name`: Display name for the device
- `secretHash`: Hashed authentication secret
- `mode`: Current operating mode (REGISTRATION or FEEDBACK)
- `lastSeenAt`: Last heartbeat timestamp
- `deletedAt`: Soft deletion timestamp
- `currentLockId`: Reference to active lock (if any)

**Indexes:**
- `(mode)`: For filtering devices by mode
- `(lastSeenAt)`: For determining online status

### KioskLock

Represents temporary locks/reservations of devices by staff members.

```prisma
model KioskLock {
  id              String       @id @default(cuid())
  deviceId        String
  staffId         String
  caseId          String
  status          LockStatus   @default(ACTIVE)
  version         Int          @default(1)
  leaseExpireAt   DateTime
  createdAt       DateTime     @default(now())
  releasedAt      DateTime?
  // ... relationships
}
```

**Key Fields:**
- `id`: Primary identifier
- `deviceId`: Reference to locked device
- `staffId`: Staff member holding the lock
- `caseId`: Associated case
- `status`: Lock status (ACTIVE, OVERRIDDEN, COMPLETED, EXPIRED)
- `version`: Version number for optimistic locking
- `leaseExpireAt`: When the lock expires
- `releasedAt`: When lock was released

**Indexes:**
- `(deviceId, status)`: For device status queries
- `(leaseExpireAt)`: For cleanup of expired locks
- `(caseId)`: For case-related queries

### Feedback

Stores student feedback on resolved cases.

```prisma
model Feedback {
  id        String      @id @default(cuid())
  caseId    String      @unique
  staffId   String
  rating    Int
  comment   String?
  createdAt DateTime    @default(now())
  // ... relationships
}
```

**Key Fields:**
- `caseId`: One-to-one relationship with case
- `rating`: Numeric rating (1-5 scale)
- `comment`: Optional text feedback
- `staffId`: Staff member who handled the case

### FeedbackSession

Manages the feedback collection process on devices.

```prisma
model FeedbackSession {
  id           String                @id @default(cuid())
  caseId       String
  staffId      String
  deviceId     String
  status       FeedbackSessionStatus @default(CREATED)
  createdAt    DateTime              @default(now())
  deliveredAt  DateTime?
  submittedAt  DateTime?
  overriddenAt DateTime?
  cancelledAt  DateTime?
  expireAt     DateTime?
  // ... relationships
}
```

**Key Fields:**
- `status`: Session lifecycle (CREATED, DELIVERED, SUBMITTED, OVERRIDDEN, CANCELLED, EXPIRED)
- `expireAt`: When the session expires
- Various timestamps track the session lifecycle

**Indexes:**
- `(deviceId, status, createdAt)`: For device session queries
- `(caseId)`: For case-related feedback sessions
- `(staffId)`: For staff workload tracking

### Session

Manages user authentication sessions.

```prisma
model Session {
  id          String    @id @default(cuid())
  staffId     String
  refreshHash String
  ua          String?
  ip          String?
  createdAt   DateTime  @default(now())
  lastUsedAt  DateTime  @default(now())
  expiresAt   DateTime
  revokedAt   DateTime?
  // ... relationships
}
```

**Key Fields:**
- `refreshHash`: Hashed refresh token
- `ua`: User agent string
- `ip`: IP address
- `expiresAt`: Session expiration
- `revokedAt`: Manual revocation timestamp

### PairingSession

Manages device pairing process.

```prisma
model PairingSession {
  id           String       @id @default(cuid())
  pairingToken String       @unique
  deviceId     String?
  status       String       @default("PENDING")
  expiresAt    DateTime
  createdAt    DateTime     @default(now())
  completedAt  DateTime?
  // ... relationships
}
```

**Key Fields:**
- `pairingToken`: Unique token for QR code
- `status`: Pairing status (PENDING, COMPLETED, EXPIRED)
- `expiresAt`: Token expiration time

**Indexes:**
- `(pairingToken)`: For token lookup
- `(expiresAt)`: For cleanup of expired tokens

### IdpAccount

Links staff accounts to identity provider accounts (Azure AD).

```prisma
model IdpAccount {
  id       String @id @default(cuid())
  staffId  String @unique
  provider String
  subject  String
  // ... relationships
}
```

### Invite

Manages staff invitation system.

```prisma
model Invite {
  id          String    @id @default(cuid())
  tokenHash   String
  createdById String
  expiresAt   DateTime
  usedAt      DateTime?
  revokedAt   DateTime?
  createdAt   DateTime  @default(now())
  // ... relationships
}
```

## Enums

### CaseStatus
- `QUEUED`: Waiting to be assigned
- `IN_PROGRESS`: Currently being handled
- `RESOLVED_PENDING_FEEDBACK`: Resolved, waiting for feedback
- `RESOLVED`: Fully completed

### StaffRole
- `STAFF`: Regular staff member
- `ADMIN`: Administrator with additional permissions

### DeviceMode
- `REGISTRATION`: Device is accepting new case registrations
- `FEEDBACK`: Device is collecting feedback

### LockStatus
- `ACTIVE`: Lock is currently active
- `OVERRIDDEN`: Lock was overridden by another staff member
- `COMPLETED`: Lock was completed normally
- `EXPIRED`: Lock expired automatically

### FeedbackSessionStatus
- `CREATED`: Session created but not delivered
- `DELIVERED`: Session delivered to device
- `SUBMITTED`: Feedback submitted by student
- `OVERRIDDEN`: Session overridden by staff
- `CANCELLED`: Session cancelled
- `EXPIRED`: Session expired

## Key Relationships

### One-to-One
- `Staff` ↔ `IdpAccount`
- `StudentCase` ↔ `Feedback`
- `KioskDevice` ↔ `KioskLock` (current lock)

### One-to-Many
- `Staff` → `StudentCase` (assigned cases)
- `Staff` → `Session` (user sessions)
- `Staff` → `KioskLock` (device locks)
- `Staff` → `Feedback` (feedback on their cases)
- `KioskDevice` → `KioskLock` (lock history)
- `KioskDevice` → `FeedbackSession` (feedback sessions)
- `StudentCase` → `FeedbackSession` (feedback attempts)

## Database Constraints

### Unique Constraints
- Staff email addresses
- Staff employee numbers
- Staff identity keys
- Device current lock (only one active lock per device)
- Case feedback (one feedback per case)
- Pairing tokens

### Check Constraints
- Feedback ratings must be between 1 and 5
- Lock expiration times must be in the future
- Device modes must be valid enum values

## Indexing Strategy

### Performance Indexes
- `StudentCase(status, createdAt)`: Optimizes queue queries
- `KioskDevice(mode)`: Fast device filtering
- `KioskDevice(lastSeenAt)`: Online status determination
- `KioskLock(deviceId, status)`: Device status queries
- `KioskLock(leaseExpireAt)`: Expired lock cleanup
- `FeedbackSession(deviceId, status, createdAt)`: Device session management

### Foreign Key Indexes
All foreign key relationships are automatically indexed by PostgreSQL.

## Migration Strategy

### Development
```bash
# Create new migration
npx prisma migrate dev --name add_new_feature

# Reset database (development only)
npx prisma migrate reset
```

### Production
```bash
# Apply migrations
npx prisma migrate deploy

# Generate client
npx prisma generate
```

### Rollback Strategy
- Migrations are numbered sequentially
- Rollback requires manual intervention
- Always backup before production migrations
- Test migrations in staging environment first

## Data Retention Policies

### Soft Deletion
- Devices: Set `deletedAt` timestamp
- Sessions: Set `revokedAt` timestamp
- Invites: Set `revokedAt` timestamp

### Hard Deletion
- Expired pairing sessions (after 24 hours)
- Old sessions (after 30 days)
- Completed feedback sessions (after 90 days)

### Archival
- Resolved cases older than 1 year
- Feedback data for analytics (anonymized)

## Backup and Recovery

### Backup Strategy
- Daily full backups
- Hourly incremental backups during business hours
- Point-in-time recovery capability
- Cross-region backup replication

### Recovery Procedures
1. Identify backup timestamp
2. Stop application servers
3. Restore database from backup
4. Verify data integrity
5. Restart application servers
6. Verify system functionality

## Performance Considerations

### Query Optimization
- Use appropriate indexes for common queries
- Avoid N+1 queries with Prisma includes
- Use database views for complex reporting queries
- Monitor slow query log

### Connection Pooling
- Configure appropriate connection pool size
- Monitor connection utilization
- Use read replicas for reporting queries

### Monitoring
- Track query performance metrics
- Monitor connection pool utilization
- Alert on lock wait times
- Monitor database size growth

## Security Considerations

### Data Protection
- All passwords are hashed using bcrypt
- Session tokens are cryptographically secure
- Device secrets are hashed
- PII data is protected according to privacy regulations

### Access Control
- Role-based access control (RBAC)
- Database user has minimal required permissions
- Regular security audits
- Encrypted connections (SSL/TLS)

### Audit Trail
- All case state changes are logged
- Staff actions are tracked
- Device activities are monitored
- Administrative actions require approval
