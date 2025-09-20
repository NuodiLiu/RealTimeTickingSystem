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
    isDeviceOnline(deviceId: string): Promise<boolean>;
    addDeviceToGroups(connectionId: string, deviceId: string, mode: DeviceMode): Promise<void>;
    removeDeviceFromGroups(connectionId: string, deviceId: string, mode: DeviceMode): Promise<void>;
    addDashboardUserToGroup(connectionId: string, userId: string): Promise<void>;
    removeDashboardUserFromGroup(connectionId: string, userId: string): Promise<void>;
    getConnectionStats(): Promise<{
        total: number;
        serverless: boolean;
    }>;
}
//# sourceMappingURL=client-new.d.ts.map