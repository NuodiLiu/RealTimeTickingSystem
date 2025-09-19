import { DeviceToServer, DeviceMode } from './types';
export declare class SignalREventHandler {
    handleDeviceConnect(deviceId: string, connectionId: string, mode: DeviceMode): Promise<void>;
    handleDeviceDisconnect(deviceId: string, connectionId: string): Promise<void>;
    handleDashboardConnect(connectionId: string, userId?: string): Promise<void>;
    handleDashboardDisconnect(connectionId: string): Promise<void>;
    handleDeviceMessage(deviceId: string, message: DeviceToServer): Promise<void>;
    private handlePong;
    private handleDelivered;
    private handleLease;
    private handleStatus;
    private handleFeedbackUpdate;
    private handleFeedbackCancelled;
}
export declare const signalREventHandler: SignalREventHandler;
//# sourceMappingURL=eventHandler.d.ts.map