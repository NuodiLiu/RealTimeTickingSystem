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
 * Validate device API key from Authorization header (HTTP API)
 * Format: Authorization: Device <deviceId>:<deviceSecret>
 */
export declare function validateDeviceApiKey(authHeader: string): Promise<{
    deviceId: string;
    device: {
        name: string;
        id: string;
        currentLockId: string | null;
        secretHash: string;
        mode: import(".prisma/client").$Enums.DeviceMode;
        lastSeenAt: Date;
        deletedAt: Date | null;
    };
}>;
//# sourceMappingURL=auth.d.ts.map