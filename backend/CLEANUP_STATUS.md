# Backend Cleanup Status - JWT Migration

## ✅ Completed Cleanups

### Auth Architecture Migration
- [x] Removed `cookie-session` and `cookie-parser` dependencies from package.json
- [x] Updated `expressApp.ts` to remove session/cookie middleware
- [x] Created `jwt-auth.middleware.ts` for stateless JWT authentication
- [x] Refactored `auth.router.ts` to remove session logic
- [x] Updated all route handlers to use `requireJWTAuth` instead of session-based auth
- [x] Implemented SignalR negotiate function with JWT validation
- [x] Updated CORS configuration for stateless authentication (credentials: false)

### File Modernization
- [x] **server.ts**: Refactored to use `createExpressApp()` for consistency with Azure Functions
- [x] **signDeviceToken function**: Moved from websocket to `lib/utils/auth.ts` 
- [x] **pair.service.ts**: Updated import to use auth utils instead of websocket

## ⚠️ Legacy Files Status

### websocket/ folder - **DEPRECATED**
**Status**: Legacy Socket.IO implementation, replaced by Azure SignalR
**Files**: 
- `index.ts`, `auth.ts`, `types.ts`, `events.ts`, etc.
- Multiple test files in `tests/websocket/`

**Action Needed**: 
- Can be safely removed after confirming no other dependencies
- Tests should be rewritten for SignalR if needed

### Tests Status
**WebSocket Tests**: Located in `tests/websocket/` - outdated due to SignalR migration
**Action**: Leave as-is for now, focus on core functionality

## 🎯 Current Architecture

### Authentication Flow
1. **Frontend**: Uses MSAL to get Azure AD access token
2. **API Requests**: Send `Authorization: Bearer <token>` header
3. **Backend**: Validates JWT using `requireJWTAuth` middleware
4. **SignalR**: Uses separate negotiate endpoint with JWT validation

### Key Components
- **JWT Middleware**: `src/middlewares/jwt-auth.middleware.ts`
- **Auth Router**: `src/routers/auth.router.ts` (stateless)
- **SignalR Negotiate**: `src/functions/negotiate.ts`
- **Express App**: `src/expressApp.ts` (shared between dev server and Azure Functions)

## 🔄 Development vs Production

### Development
- Use `npm run dev` (Express server via `server.ts`)
- Mock JWT tokens via `/api/auth/dev-login`
- Same Express app as production

### Production  
- Azure Functions runtime
- Real Azure AD JWT tokens
- Azure SignalR Service (serverless mode)

---
*Last updated: September 19, 2025*
