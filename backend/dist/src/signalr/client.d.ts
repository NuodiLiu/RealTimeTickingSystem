import { ServerToDevice, DeviceMode, FeedbackShowPayload } from './types';
export declare class SignalRClient {
    constructor();
    sendToDevice(deviceId: string, message: ServerToDevice): Promise<boolean>;
    sendToDashboard(message: any): Promise<void>;
    broadcastToDevices(message: ServerToDevice, mode?: DeviceMode): Promise<void>;
    showFeedback(deviceId: string, payload: FeedbackShowPayload): Promise<boolean>;
    dismissDevice(deviceId: string): Promise<boolean>;
    pingDevice(deviceId: string, payload?: {
        now: string;
    }): Promise<boolean>;
    lockAssigned(deviceId: string, payload: any): Promise<boolean>;
    modeChanged(deviceId: string, mode: DeviceMode): Promise<boolean>;
    unpaired(deviceId: string): Promise<boolean>;
    notifyDashboard(message: any): Promise<void>;
    notifyDashboard(type: string, payload: any): Promise<void>;
    caseUpdated(caseData: {
        id: string;
        status: string;
    }): Promise<void>;
    deviceUpdated(deviceData: {
        id: string;
        isBusy: boolean;
        isOnline: boolean;
    }): Promise<void>;
    deviceConnected(deviceId: string, mode: DeviceMode): Promise<void>;
    deviceDisconnected(deviceId: string): Promise<void>;
    isDeviceConnected(deviceId: string): Promise<boolean>;
    isDeviceOnline(deviceId: string): Promise<boolean>;
    assignLockToDevice(deviceId: string, payload: any): Promise<boolean>;
    changeModeDevice(deviceId: string, mode: DeviceMode): Promise<boolean>;
    unpairDevice(deviceId: string): Promise<boolean>;
    pingAllDevices(): Promise<void>;
    addDeviceToGroups(connectionId: string, deviceId: string, mode: DeviceMode): Promise<void>;
    removeDeviceFromGroups(connectionId: string, deviceId: string, mode: DeviceMode): Promise<void>;
    addDashboardToGroup(connectionId: string): Promise<void>;
    removeDashboardFromGroup(connectionId: string): Promise<void>;
    addDashboardUserToGroup(connectionId: string, userId: string): Promise<void>;
    removeDashboardUserFromGroup(connectionId: string, userId: string): Promise<void>;
    getConnectionStats(): Promise<{
        total: number;
        serverless: boolean;
    }>;
}
export declare const signalRClient: SignalRClient;
//# sourceMappingURL=client.d.ts.map