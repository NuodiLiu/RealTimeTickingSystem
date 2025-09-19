export { signalRClient } from './client';
export { signalRConfig } from './config';
export { signalREventHandler } from './eventHandler';
export { generateSignalRToken, generateDashboardToken, verifySignalRToken, signalRAuthMiddleware, getDeviceConnectionUrl, getDashboardConnectionUrl, type SignalRAuthRequest } from './auth';
export { default as signalRRoutes } from './routes';
export * from './types';
import { ServerToDevice, DeviceMode, FeedbackShowPayload } from './types';
/**
 * SignalR Gateway - Provides the same interface as the websocket DeviceGateway
 * This class can be used as a drop-in replacement for the websocket system
 * Optimized for serverless environments
 */
export declare class SignalRGateway {
    static isDeviceOnline(deviceId: string): Promise<boolean>;
    static getConnectionStats(): Promise<{
        total: number;
        serverless: boolean;
    }>;
    static sendToDevice(deviceId: string, message: ServerToDevice): Promise<boolean>;
    static showFeedback(deviceId: string, payload: FeedbackShowPayload): Promise<boolean>;
    static dismissDevice(deviceId: string): Promise<boolean>;
    static pingDevice(deviceId: string, payload?: {
        now: string;
    }): Promise<boolean>;
    static assignLockToDevice(deviceId: string, payload: any): Promise<boolean>;
    static changeModeDevice(deviceId: string, mode: DeviceMode): Promise<boolean>;
    static unpairDevice(deviceId: string): Promise<boolean>;
    static broadcastToDevices(message: ServerToDevice, mode?: DeviceMode): Promise<void>;
    static notifyDashboard(message: {
        type: string;
        payload: any;
    }): Promise<void>;
    static pingAllDevices(): Promise<void>;
    static handleDeviceConnect(deviceId: string, connectionId: string, mode: DeviceMode): Promise<void>;
    static handleDeviceDisconnect(deviceId: string, connectionId: string): Promise<void>;
    static handleDeviceMessage(deviceId: string, message: any): Promise<void>;
    static handleDashboardConnect(connectionId: string, userId?: string): Promise<void>;
    static handleDashboardDisconnect(connectionId: string): Promise<void>;
}
export default SignalRGateway;
//# sourceMappingURL=index.d.ts.map