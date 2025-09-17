# System Sequence Diagrams

Visualises the key interaction flows in the system, showing how different components communicate with each other

## 1. Staff Authentication Flow

Shows how staff members log in using Azure AD OAuth and establish authenticated sessions.

```mermaid
sequenceDiagram
    participant Staff
    participant Frontend
    participant Backend
    participant AzureAD as Azure AD
    
    Staff->>Frontend: Access dashboard
    Frontend->>Backend: GET /auth/me
    
    alt if session exists and valid
        Backend->>Frontend: 200 OK with user data
        Frontend->>Staff: Show authenticated dashboard
    else no valid session
        Backend->>Frontend: 401 Unauthorised
        Frontend->>Staff: Redirect to login page
        Staff->>Frontend: Click "Login"
        Frontend->>Backend: GET /auth/login
        Backend->>Backend: Generate state & nonce
        Backend->>AzureAD: 302 Redirect to OAuth with state/nonce
        
        AzureAD->>Staff: Show Microsoft login
        Staff->>AzureAD: Enter credentials
        AzureAD->>Backend: GET /auth/redirect?code=...&state=...
        
        Backend->>Backend: Validate state parameter
        Backend->>AzureAD: Exchange code for tokens (sync)
        AzureAD->>Backend: Return user info & ID token claims
        Backend->>Backend: Validate nonce in ID token
        Backend->>Backend: Create session with identity key
        Backend->>Frontend: 302 Redirect to frontend with session cookie
        Frontend->>Staff: Show authenticated dashboard
    end
```

## 2. Device Pairing Process

Demonstrates how iPad devices are securely paired to the system using QR codes

```mermaid
sequenceDiagram
    participant Staff
    participant Dashboard
    participant Backend
    participant iPad
    participant WebSocket as WebSocket Server
    
    Staff->>Dashboard: Click "Pair New Device"
    Dashboard->>Backend: POST /pair/generate-qr
    Backend->>Backend: Generate pairingToken & expiry (5min)
    Backend->>Backend: Store in pairingSession table
    Backend->>Backend: Create QR URL with pairingToken & API endpoint
    Backend->>Dashboard: Return QR code data
    Dashboard->>Staff: Display QR code
    
    Note over iPad: Staff scans QR code with iPad
    iPad->>Backend: POST /pair/complete (pairingToken, deviceName, mode)
    
    alt if pairingToken valid and not expired
        Backend->>Backend: Generate deviceSecret & hash
        
        alt if device name already exists
            Backend->>Backend: Update existing device with new secret
        else new device
            Backend->>Backend: Create new KioskDevice record
        end
        
        Backend->>Backend: Generate WebSocket JWT token
        Backend->>Backend: Mark pairingSession as COMPLETED
        Backend-->>WebSocket: Broadcast device:paired event (async)
        WebSocket-->>Dashboard: Notify all dashboards
        Dashboard->>Staff: Show new device as "Online"
        Backend->>iPad: Return deviceId, deviceSecret, wsToken, wsEndpoint
        
        iPad->>WebSocket: Connect with JWT auth token
        WebSocket->>Backend: Validate JWT and update lastSeenAt
        WebSocket-->>Dashboard: Update device status to online
    else pairingToken invalid/expired
        Backend->>iPad: 400 Bad Request 
    end
```

## 3. Case Creation & Queue Management

Shows the complete flow from student submitting a help request to staff taking the case

```mermaid
sequenceDiagram
    participant Student
    participant iPad
    participant Backend
    participant WebSocket as WebSocket Server
    participant Dashboard
    participant Staff
    
    Student->>iPad: Fill out registration form
    iPad->>Backend: POST /cases (with device auth)
    
    alt if device authenticated and valid
        Backend->>Backend: Validate, create case
        Backend->>Backend: Assign queue position
        Backend->>iPad: 201 Created with case ID
        iPad->>Student: Show "Request submitted" message
        
        par Broadcast to all connected staff
            Backend-->>WebSocket: 'case:created' event (async)
            WebSocket-->>Dashboard: Send case to connected staff
            Dashboard->>Staff: Show new case in queue
        end
        
        Note over Staff: Staff member decides to help
        Staff->>Dashboard: Click "Take Case"
        Dashboard->>Backend: POST /cases/:id/take
        
        alt if case still available
            Backend->>Backend: Assign case to staff
            Backend->>Backend: Update status to IN_PROGRESS
            Backend->>Dashboard: 200 OK with updated case
            Dashboard->>Staff: Show case in "My Active Cases"
            
            par Update all dashboards
                Backend-->>WebSocket: 'case:updated' event (async)
                WebSocket-->>Dashboard: Update all dashboards
                Dashboard->>Staff: Remove case from queue
            end
        else case already taken
            Backend->>Dashboard: 409 Conflict - Case taken
            Dashboard->>Staff: Show "Case no longer available"
        end
        
    else device not authenticated
        Backend->>iPad: 401 Unauthorised
        iPad->>Student: Show Connection error
    end
```

## 4. Case Resolution & Feedback Request

Demonstrates how staff resolve cases and request feedback from students

```mermaid
sequenceDiagram
    participant Staff
    participant Dashboard
    participant Backend
    participant WebSocket as WebSocket Server
    participant iPad
    participant Student
    
    Note over Staff: Staff finishes helping student
    Staff->>Dashboard: Click "Resolve Case"
    Dashboard->>Backend: POST /cases/:id/resolve
    Backend->>Backend: Update case status to RESOLVED
    Backend->>Dashboard: 200 OK
    Dashboard->>Staff: Show "Request Feedback" button
    
    Staff->>Dashboard: Click "Request Feedback"
    Dashboard->>Backend: POST /feedback/send
    
    alt if device available for feedback
        Backend->>Backend: Create FeedbackSession record
        Backend->>Backend: Create KioskLock for device
        Backend->>Backend: Update device currentLockId
        
        par Send feedback request to device
            Backend-->>iPad: Send FEEDBACK_REQUEST via WebSocket (async)
        and Update all dashboards
            Backend-->>WebSocket: 'device:status_changed' event (async)
            WebSocket-->>Dashboard: Update device as pending feedback
        end
        
        Backend->>Dashboard: 200 OK - Feedback requested
        Dashboard->>Staff: Show Feedback in progress
        
        iPad->>Backend: Send DELIVERED message via WebSocket
        Backend->>Backend: Update FeedbackSession status to DELIVERED
        iPad->>Student: Show feedback form
        
        alt if student submits feedback
            Student->>iPad: Submit rating & comment
            iPad->>Backend: Send FEEDBACK_SUBMITTED via WebSocket
            Backend->>Backend: Create Feedback record
            Backend->>Backend: Update FeedbackSession to SUBMITTED
            Backend->>Backend: Complete KioskLock & release device
            Backend->>Backend: Update case status: RESOLVED
            iPad->>Student: Show comfirmation message
        else if student cancels feedback
            Student->>iPad: Close/cancel feedback
            iPad->>Backend: Send FEEDBACK_CANCELLED via WebSocket
            Backend->>Backend: Update FeedbackSession to CANCELLED
            Backend->>Backend: Complete KioskLock & release device
            Backend->>Backend: Update case status to RESOLVED
        end
        
        par Notify all connected clients
            Backend-->>WebSocket: 'feedback:completed' event (async)
            WebSocket-->>Dashboard: Update device as "Online"
            WebSocket-->>Dashboard: Update case status
            Dashboard->>Staff: Show feedback received notification
        end
        
    else device busy or offline
        Backend->>Dashboard: 409 Conflict - Device unavailable
        Dashboard->>Staff: Show "Device busy, try again later"
    end
```

## 5. Real-time Updates via WebSocket

Shows how the system maintains real-time synchronisation across all connected clients

```mermaid
sequenceDiagram
    participant Device1 as iPad Device
    participant Backend
    participant WebSocket as WebSocket Server
    participant Dashboard1 as Staff Dashboard 1
    participant Dashboard2 as Staff Dashboard 2
    
    Note over Device1: Device connection issue occurs
    Device1--xBackend: Connection lost (async failure)
    
    Backend->>Backend: Detect missed heartbeat (after timeout)
    Backend->>Backend: Update device status to OFFLINE
    
    par Broadcast to all connected dashboards
        Backend-->>WebSocket: 'device:status_changed' event (async)
        WebSocket-->>Dashboard1: Send device status update (async)
        WebSocket-->>Dashboard2: Send device status update (async)
        Dashboard1->>Dashboard1: Update device indicator to offline
        Dashboard2->>Dashboard2: Update device indicator to offline
    end
    
    Note over Device1: Device reconnects to network
    Device1->>WebSocket: Reconnect with JWT (sync handshake)
    
    alt if JWT valid and not expired
        WebSocket->>Backend: Validate device connection
        Backend->>Backend: Update device status to ONLINE
        Backend->>Backend: Update lastSeenAt timestamp
        
        par Broadcast status change
            Backend-->>WebSocket: 'device:status_changed' event (async)
            WebSocket-->>Dashboard1: Send device status update (async)
            WebSocket-->>Dashboard2: Send device status update (async)
            Dashboard1->>Dashboard1: Update device indicator to online
            Dashboard2->>Dashboard2: Update device indicator to online
        end
        
        Backend->>WebSocket: Connection approved
        WebSocket->>Device1: Connection established
    else JWT invalid or expired
        WebSocket->>Device1: 401 Unauthorised - reconnect needed
        Device1->>Backend: GET /device/ws-token (get new token)
        Backend->>Device1: Return fresh JWT
        Device1->>WebSocket: Reconnect with new JWT
    end
    
    Note over Dashboard1: Staff creates new case
    
    par broadcast to all clients
        Backend-->>WebSocket: 'case:queue_updated' event (async)
        WebSocket-->>Dashboard1: Send updated queue (async)
        WebSocket-->>Dashboard2: Send updated queue (async)
        Dashboard1->>Dashboard1: Add case to queue
        Dashboard2->>Dashboard2: Add case to queue
    end
```

## 6. Error Handling & Network Recovery

Illustrates how the system handles network issues and provides user feedback

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant Toast as Toast Notifications
    
    User->>Frontend: Perform action (take case)
    Note over Frontend: Network is offline
    Frontend->>Backend: POST /cases/:id/take
    Backend--xFrontend: Network timeout/error (async failure)
    
    alt if network error detected
        Frontend->>Frontend: Detect network error type
        Frontend-->>Toast: Show "Unable to connect" message (async)
        Toast-->>User: Display offline notification (async)
        Frontend->>Frontend: Store failed request for retry
    else if server error 
        Frontend-->>Toast: Show "Server temporarily unavailable" (async)
        Toast-->>User: Display server error notification (async)
    end
    
    Note over Frontend: Network status changes
    Frontend->>Frontend: Detect online status change
    
    opt if network restored and pending requests exist
        Frontend->>Backend: Retry failed request (sync)
        
        alt if retry successful
            Backend->>Frontend: 200 OK with updated data
            Frontend-->>Toast: Show "Connection restored" (async)
            Toast-->>User: Display success notification (async)
            Frontend->>Frontend: Update UI with new data
        else if retry still fails
            Backend->>Frontend: Error response
            Frontend-->>Toast: Show "Still having connection issues" (async)
            Toast-->>User: Display retry error (async)
        end
    end
    
    Note over User: error scenario - Database issue
    User->>Frontend: Submit feedback override
    Frontend->>Backend: POST /feedback/override
    Backend--xFrontend: 500 Database error (sync failure)
    
    alt if specific error message available
        Frontend->>Frontend: Parse error response
        Frontend-->>Toast: Show error message (async)
        Toast-->>User: Display "Database temporarily unavailable" (async)
        Frontend->>Frontend: Keep override button enabled
    else if generic error
        Frontend-->>Toast: Show generic error message (async)
        Toast-->>User: Display error (async)
    end
```

## 7. Device Health Monitoring

Shows the continuous health monitoring system for iPad devices

```mermaid
sequenceDiagram
    participant iPad
    participant Backend
    participant WebSocket as WebSocket Server
    participant Dashboard
    participant CleanupService as Device Cleanup Service
    
    Note over iPad: Device connects to WebSocket
    iPad->>WebSocket: Connect with JWT token
    WebSocket->>Backend: Validate token, update lastSeenAt
    Backend-->>Dashboard: Notify device online
    
    loop Every 15 seconds
        Backend-->>iPad: Send PING via WebSocket
        iPad-->>Backend: Send PONG via WebSocket
        Backend->>Backend: Update lastSeenAt timestamp
    end
    
    Note over iPad: Device loses internet connection
    iPad--xWebSocket: WebSocket connection lost
    Backend->>Backend: Stop receiving PONG responses
    
    Note over Backend: Connection cleanup after timeout
    Backend->>Backend: Detect device disconnect
    
    alt if device had active lock/feedback session
        Backend->>Backend: Clean up active KioskLock
        Backend->>Backend: Cancel pending FeedbackSession
        Backend->>Backend: Resolve associated case
        Backend->>Backend: Release device from currentLockId
        Backend-->>Dashboard: Notify case resolved, device free
    end
    
    Backend-->>Dashboard: Broadcast device offline status
    Dashboard->>Dashboard: Show device as "Offline"
    
    Note over iPad: Connection restored
    iPad->>WebSocket: Reconnect with JWT token
    
    alt if JWT still valid
        WebSocket->>Backend: Accept connection & update lastSeenAt
        Backend-->>Dashboard: Notify device back online
        Dashboard->>Dashboard: Show device as "Online"
    else JWT expired
        WebSocket->>iPad: 401 Unauthorised
        iPad->>Backend: GET /device/ws-token (get new token)
        Backend->>iPad: Return fresh JWT
        iPad->>WebSocket: Reconnect with new JWT
    end
```

## 8. Case Escalation Process

Demonstrates how cases can be escalated to higher priority queues

```mermaid
sequenceDiagram
    participant Staff
    participant Dashboard
    participant Backend
    participant WebSocket as WebSocket Server
    participant AdminDashboard as Admin Dashboard
    
    Staff->>Dashboard: Click "Escalate Case"
    Dashboard->>Backend: POST /cases/:id/escalate
    Backend->>Backend: Validate staff permissions
    Backend->>Backend: Update case escalatedTo field
    Backend->>Backend: Move to priority queue
    Backend->>Dashboard: Return updated case
    Dashboard->>Staff: Show "Case escalated" confirmation
    
    Backend->>WebSocket: Broadcast 'case:escalated' event
    WebSocket->>AdminDashboard: Send escalation notification
    AdminDashboard->>AdminDashboard: Show in priority queue
    WebSocket->>Dashboard: Update all staff dashboards
    Dashboard->>Dashboard: Update case status display
    
    Note over AdminDashboard: Admin takes escalated case
    AdminDashboard->>Backend: POST /cases/:id/take
    Backend->>Backend: Assign to admin staff
    Backend->>WebSocket: Broadcast case assignment
    WebSocket->>Dashboard: Remove from available queue
    WebSocket->>AdminDashboard: Move to admin's active cases
```

## 9. Excel Export Flow

Shows how staff can export case data for reporting and analysis

```mermaid
sequenceDiagram
    participant Staff
    participant Dashboard
    participant Backend
    participant Database
    participant ExcelService as Excel Generation Service
    
    Staff->>Dashboard: Click "Export Data"
    Dashboard->>Backend: GET /excel/preview
    Backend->>Database: Query case statistics
    Database->>Backend: Return counts and date ranges
    Backend->>Dashboard: Return export preview
    Dashboard->>Staff: Show export options dialog
    
    Staff->>Dashboard: Select date range & format
    Dashboard->>Backend: GET /excel/cases/xlsx?startDate=...&endDate=...
    Backend->>Database: Query filtered cases
    Database->>Backend: Return case data
    Backend->>ExcelService: Generate Excel file
    ExcelService->>Backend: Return Excel buffer
    Backend->>Dashboard: Stream Excel file
    Dashboard->>Staff: Trigger file download
    
    Note over Staff: File downloads to device
    Staff->>Staff: Open and analyze exported data
```

---
