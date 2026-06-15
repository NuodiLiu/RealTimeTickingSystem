// Heartbeat architecture:
// - iPad actively reports HTTP heartbeat every 30-60s (updates lastSeenAt & isConnected)
// - Backend pushes tasks/commands via SignalR in real-time
// - Device considered offline if lastSeenAt > ONLINE_GRACE_MS
export const ONLINE_GRACE_MS = 120_000;      // 2 minutes - determines offline status
export const LOCK_LEASE_SECONDS = 60;        // lock initial lease 
export const SESSION_EXPIRE_MINUTES = 5;     // session expire time
