/**
 * Device JWT payload structure for WebSocket/SignalR connections
 */
export type DeviceJwtPayload = {
    typ: 'device';
    sub: string;
    mode: string;
    iat?: number;
    exp?: number;
};
/**
 * Generate a JWT token for device authentication
 * Used for device WebSocket/SignalR connections
 */
export declare function signDeviceToken(deviceId: string, mode: string): string;
/**
 * Staff JWT payload structure for API access
 */
export type StaffJwtPayload = {
    typ: 'staff';
    sub: string;
    role: 'ADMIN' | 'STAFF';
    employeeNo: string;
    identityKey: string;
    name?: string;
    email?: string;
    iat?: number;
    exp?: number;
};
/**
 * Generate a short-lived JWT token for staff API access
 * Used after Azure AD authentication for API calls
 */
export declare function signStaffToken(staffData: {
    id: string;
    role: 'ADMIN' | 'STAFF';
    employeeNo: string;
    identityKey: string;
    name?: string;
    email?: string;
}): string;
/**
 * Verify and decode staff JWT token
 */
export declare function verifyStaffToken(token: string): StaffJwtPayload;
/**
 * Validate device API key from Authorization header (HTTP API)
 * Format: Authorization: Device <deviceId>:<deviceSecret>
 */
export declare function validateDeviceApiKey(authHeader: string): Promise<{
    deviceId: string;
    device: {
        id: string;
        name: string;
        currentLockId: string | null;
        secretHash: string;
        mode: import(".prisma/client").$Enums.DeviceMode;
        lastSeenAt: Date;
        deletedAt: Date | null;
    };
}>;
//# sourceMappingURL=auth.d.ts.map