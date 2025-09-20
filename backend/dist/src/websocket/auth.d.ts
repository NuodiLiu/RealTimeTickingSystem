import type { Socket } from "socket.io";
export declare function verifyDeviceHandshake(socket: Socket): Promise<{
    deviceId: string;
    mode: string;
}>;
export declare function verifySocketHandshake(socket: Socket): Promise<{
    type: 'device' | 'dashboard';
    deviceId?: string;
    mode?: string;
    userId?: string;
}>;
export declare function signDeviceToken(deviceId: string, mode: string): string;
//# sourceMappingURL=auth.d.ts.map