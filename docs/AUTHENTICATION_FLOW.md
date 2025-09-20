# Authentication Flow Documentation

## Overview

The system uses **Azure AD OAuth 2.0 SSO** for authentication with a hybrid approach:
- **Frontend**: Uses App JWT tokens stored in localStorage
- **Backend**: Azure AD MSAL server-side authentication
- **Token Exchange**: Backend validates Azure AD tokens and issues App JWT tokens

## Architecture

```
User Browser → Azure AD → Backend (MSAL) → App JWT → Frontend (Zustand Store)
```

## Detailed Flow

### 1. Initial Login Process

#### Frontend (login/page.tsx)
```typescript
// User clicks "Continue with Microsoft" button
const handleLogin = async () => {
  // Redirect to backend OAuth initiation endpoint
  window.location.href = `${API_BASE}/auth/login`;
};
```

#### Backend Authentication Flow

1. **OAuth Initiation** (`/auth/login`)
   ```typescript
   // backend/src/routers/auth.router.ts
   router.get('/login', async (req, res) => {
     const authUrl = await msalClient.getAuthCodeUrl({
       scopes: ["openid", "profile", "email", "api://57938c34-d786-42be-81e9-2a758b7e14b2/Api.Read"],
       redirectUri: "https://api.localhost/auth/redirect"
     });
     res.redirect(authUrl); // Redirect to Azure AD
   });
   ```

2. **OAuth Callback** (`/auth/redirect`)
   ```typescript
   router.post('/redirect', async (req, res) => {
     // Exchange authorization code for tokens
     const tokenResponse = await msalClient.acquireTokenByCode({
       code: req.body.code,
       scopes: ["openid", "profile", "email", "api://57938c34-d786-42be-81e9-2a758b7e14b2/Api.Read"],
       redirectUri: "https://api.localhost/auth/redirect"
     });
     
     // Extract user info from Azure AD token
     const userInfo = extractUserInfo(tokenResponse);
     
     // Generate App JWT
     const appJwt = jwt.sign(
       { userId: userInfo.id, email: userInfo.email, role: userInfo.role },
       JWT_SECRET,
       { expiresIn: '7d' }
     );
     
     // Return App JWT to frontend
     res.json({ 
       token: appJwt,
       user: userInfo 
     });
   });
   ```

### 2. Frontend State Management (Zustand)

#### Authentication Store (`stores/authStore.ts`)
```typescript
export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  isInitialized: false,
  
  // Single-flight initialization pattern
  initialize: async () => {
    const appJwt = localStorage.getItem('appJwt');
    
    if (appJwt) {
      // Validate token with backend
      const response = await AuthAPI.me();
      if (response.user) {
        set({
          user: response.user,
          isAuthenticated: true,
          isInitialized: true,
          isLoading: false
        });
      }
    } else {
      set({
        user: null,
        isAuthenticated: false,
        isInitialized: true,
        isLoading: false
      });
    }
  }
}));
```

### 3. Route Protection

#### AuthGuard Component
```typescript
export function AuthGuard({ children, requireAuth = true }) {
  const { isAuthenticated, isLoading, isInitialized, initialize } = useAuthStore();

  useEffect(() => {
    if (!isInitialized) {
      initialize(); // Trigger auth check on app load
    }
  }, [isInitialized, initialize]);

  // Show loading while checking auth
  if (!isInitialized || isLoading) {
    return <LoadingSpinner />;
  }

  // Redirect if auth required but not authenticated
  if (requireAuth && !isAuthenticated) {
    router.push('/login');
    return null;
  }

  return <>{children}</>;
}
```

### 4. API Authentication

#### HTTP Interceptor (`lib/api.ts`)
```typescript
const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000
});

// Request interceptor to add JWT token
api.interceptors.request.use((config) => {
  const appJwt = localStorage.getItem('appJwt');
  if (appJwt) {
    config.headers.Authorization = `Bearer ${appJwt}`;
  }
  return config;
});

// Response interceptor for token refresh/logout
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired, clear auth and redirect
      localStorage.removeItem('appJwt');
      useAuthStore.getState().reset();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

## Security Features

### 1. Token Management
- **App JWT**: 7-day expiration, stored in localStorage
- **HttpOnly Cookies**: For refresh tokens (future enhancement)
- **Automatic Cleanup**: Invalid tokens removed on 401 responses

### 2. Route Protection
- **AuthGuard**: Protects authenticated routes
- **Role-based Access**: Admin/Staff role checking
- **Initialization Pattern**: Single-flight auth checking

### 3. CSRF Protection
- **Azure AD Validation**: Backend validates all Azure AD tokens
- **JWT Signing**: App JWTs signed with server secret
- **Scope Validation**: Specific API scopes required

## Configuration

### Frontend Environment
```env
NEXT_PUBLIC_API_BASE_URL=https://api.localhost
```

### Backend Environment  
```env
# Azure AD Configuration
AZURE_CLIENT_ID=2df639bf-8b42-4d95-9d39-5b1035424a5f
AZURE_CLIENT_SECRET=<secret>
AZURE_TENANT_ID=<tenant-id>
AZURE_REDIRECT_URI=https://api.localhost/auth/redirect

# JWT Configuration
JWT_SECRET=<secret>
JWT_EXPIRES_IN=7d
```

### Azure AD App Registrations

#### Frontend App (2df639bf-8b42-4d95-9d39-5b1035424a5f)
- **Type**: Single Page Application
- **Redirect URIs**: `https://localhost:3000/auth/callback`
- **Scopes**: `api://57938c34-d786-42be-81e9-2a758b7e14b2/Api.Read`

#### Backend App (57938c34-d786-42be-81e9-2a758b7e14b2)
- **Type**: Web Application  
- **Redirect URIs**: `https://api.localhost/auth/redirect`
- **API Scopes**: `Api.Read`
- **Admin Consent**: Required

## API Endpoints

### Authentication Endpoints
- `GET /auth/login` - Initiate OAuth flow
- `POST /auth/redirect` - OAuth callback handler
- `GET /auth/me` - Validate current user
- `POST /auth/logout` - Clear authentication

### Protected Endpoints
All other API endpoints require `Authorization: Bearer <app-jwt>` header.

## Error Handling

### Common Scenarios
1. **Token Expired**: 401 → Auto logout → Redirect to login
2. **Invalid Token**: 401 → Clear localStorage → Redirect to login  
3. **Network Error**: Retry logic in API client
4. **Azure AD Error**: Display user-friendly error message

### Debug Logging
```typescript
console.log('[AuthStore] Initialize:', { hasJwt, isValid });
console.log('[AuthGuard] Route decision:', { requireAuth, isAuthenticated });
console.log('[API] Request:', { url, hasAuth: !!token });
```

## Migration Notes

### Removed Components
- ❌ MSAL Provider (replaced with App JWT)
- ❌ useAuth hook (replaced with Zustand store)
- ❌ AppInitializer (auth initialization moved to AuthGuard)
- ❌ Mounted guards (replaced with proper state management)

### New Architecture Benefits
- ✅ Single-flight authentication checking
- ✅ Proper global state management
- ✅ No race conditions in auth flow
- ✅ Cleaner separation of concerns
- ✅ Better error handling and debugging

## Testing

### Login Flow Testing
1. Navigate to `/login`
2. Click "Continue with Microsoft"
3. Complete Azure AD authentication
4. Verify redirect to `/dashboard`
5. Verify JWT stored in localStorage
6. Verify API calls include Authorization header

### Logout Flow Testing
1. Click logout button
2. Verify localStorage cleared
3. Verify redirect to `/login`
4. Verify subsequent API calls fail with 401

### Route Protection Testing
1. Access `/dashboard` without auth → Redirect to `/login`
2. Access `/login` with valid auth → Redirect to `/dashboard`
3. Token expiry → Auto logout → Redirect to `/login`
