# Frontend Documentation

## Overview
React/Next.js frontend for the system providing staff dashboard and public queue display functionality.

## Tech Stack
- **Framework**: Next.js 15.5.2 with TypeScript
- **Styling**: Tailwind CSS with responsive design
- **State Management**: React hooks and custom hooks
- **Real-time**: Socket.IO client for live updates
- **Notifications**: React Hot Toast
- **Authentication**: Session-based with Azure AD integration

## Project Structure

```
src/app/
├── components/           # Reusable UI components
│   ├── dashboard/       # Dashboard-specific components
│   ├── layout/          # Layout components
│   └── ExcelExport/     # Excel export functionality
├── hooks/               # Custom React hooks
├── lib/                 # Utilities and API client
├── dashboard/           # Main staff dashboard
├── public-display/      # Public queue display
├── login/               # Authentication pages
└── globals.css          # Global styles
```

## Key Features

### **Dashboard** (`/dashboard`)
- **Queue Management**: View and take cases from queue
- **Active Cases**: Manage assigned cases with feedback workflow
- **Device Management**: Pair/unpair iPad devices, monitor status
- **Real-time Updates**: Live case and device status updates
- **Excel Export**: Admin-only data export functionality

### **Public Display** (`/public-display`)
- **Queue Visualization**: Shows waiting students and wait times
- **Real-time Updates**: Automatically updates as queue changes
- **Responsive Design**: Works on various screen sizes

## Architecture

### **API Integration**
```typescript
// Central API client with error handling
const api = new APIClient('http://localhost:3000')

// Endpoints organized by domain
CasesAPI.getQueue()
DeviceAPI.getStatus()
FeedbackAPI.submit()
```

### **Real-time Communication**
```typescript
// Socket.IO integration for live updates
const socket = io('/ws', { transports: ['websocket'] })
socket.on('event', handleRealTimeUpdate)
```

### **State Management**
```typescript
// Custom hooks for complex state
const { queued, loading, takeNext } = useQueue()
const { devices, pairDevice } = useDevices()
```

## Component Patterns

### **Smart Components**
- Handle API calls and state management
- Located in `/dashboard/page.tsx`, `/public-display/page.tsx`

### **Presentation Components**
- Focus on UI rendering
- Accept props and emit events
- Located in `/components/`

### **Custom Hooks**
- `useQueue()` - Queue management logic
- `useDevices()` - Device operations
- `useUser()` - Authentication state

## Authentication Flow

1. **Login Redirect**: `/login` → Azure AD OAuth
2. **Session Creation**: Backend sets session cookie
3. **Protected Routes**: All dashboard routes require authentication
4. **Auto-logout**: Session expires or manual logout

## Error Handling

### **Network Errors**
- 3-second timeout for offline detection
- Global error handlers prevent database error popups
- User-friendly toast notifications

### **API Errors**
- Standardized error responses
- Toast notifications with appropriate messaging
- Graceful degradation for offline scenarios

## Styling System

### **Design Tokens**
- **Colors**: Gray scale (`gray-900`, `zinc-500`, etc.)
- **Typography**: Consistent font weights (`font-semibold`, `font-medium`)
- **Spacing**: Tailwind spacing scale
- **Responsive**: Mobile-first design

### **Component Styling**
```typescript
className="px-4 py-2 rounded-md border border-gray-300 hover:bg-gray-50"

// Card layouts
className="bg-white rounded-lg border border-gray-200 p-4"
```

## Real-time Features

### **WebSocket Events**
- `case:created` - New case added to queue
- `case:updated` - Case status changed
- `device:status` - Device online/offline status
- `case:feedback_ready` - Case ready for feedback

### **Live Updates**
- Queue position changes
- Device status indicators
- Case assignments
- Feedback notifications

## Performance Optimizations

### **Smart Re-rendering**
- React.memo for expensive components
- Debounced updates for real-time events
- Efficient state updates

### **Loading States**
- Skeleton loaders for better UX
- Progressive loading for large datasets
- Background updates without blocking UI

## Development Workflow

### **Local Development**
```bash
npm run dev  # Start development server on :3001
```

### **Environment Variables**
```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000  # Backend API URL
```

### **Code Style**
- TypeScript strict mode
- ESLint + Prettier
- Consistent comment style (`//` comments)

## Key Routes

| Route | Purpose | Authentication |
|-------|---------|----------------|
| `/` | Home redirect | Optional |
| `/login` | Azure AD login | None |
| `/dashboard` | Main staff interface | Required |
| `/public-display` | Queue display | None |

## Browser Support
- Modern browsers with ES2020+ support
- WebSocket support required for real-time features
- Responsive design for desktop and tablet

## Troubleshooting

### **Common Issues**
- **Auth Failures**: Check session cookies and backend connectivity
- **Real-time Not Working**: Verify WebSocket connection
- **Slow Performance**: Check network timeout settings (3s default)

### **Debug Tools**
- Browser DevTools for network issues
- Console logs for real-time events
- React DevTools for component debugging

---

*For backend API documentation, see `/backend/docs/api.yaml` or visit http://localhost:3000/api-docs*
