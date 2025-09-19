import { DeviceMode, DeviceWithStatus, ListFilters } from '../lib/utils/type';
export declare class DeviceService {
    static handleHeartbeat(deviceId: string): Promise<{
        success: boolean;
        status: "IDLE" | "BUSY";
        deviceMode: import(".prisma/client").$Enums.DeviceMode;
        timestamp: Date;
        currentLock: {
            id: string;
            status: import(".prisma/client").$Enums.LockStatus;
            case: {
                id: string;
                studentName: string;
                category: string;
                status: import(".prisma/client").$Enums.CaseStatus;
            };
            staffName: string | null;
            leaseExpireAt: Date;
        } | null;
    }>;
    static getDeviceStatus(deviceId: string): Promise<{
        deviceId: string;
        name: string;
        mode: import(".prisma/client").$Enums.DeviceMode;
        status: "OFFLINE" | "IDLE" | "BUSY";
        isOnline: boolean;
        lastSeenAt: Date;
        currentLock: {
            id: string;
            status: import(".prisma/client").$Enums.LockStatus;
            version: number;
            case: {
                id: string;
                studentName: string;
                category: string;
                status: import(".prisma/client").$Enums.CaseStatus;
            };
            staffName: string | null;
            leaseExpireAt: Date;
        } | null;
    }>;
    static isDeviceOnline(lastSeenAt: Date, thresholdMinutes?: number): boolean;
    static isDeviceOnlineDynamic(deviceId: string, lastSeenAt: Date, thresholdMinutes?: number): Promise<boolean>;
    static isDeviceConnectedViaSignalR(deviceId: string): Promise<boolean>;
    static listDevices(filters?: ListFilters): Promise<DeviceWithStatus[]>;
    static getDevicesByMode(mode: DeviceMode): Promise<{
        deviceId: any;
        name: any;
        mode: any;
        status: "OFFLINE" | "IDLE" | "BUSY";
        isOnline: boolean;
        lastSeenAt: any;
        currentLock: {
            id: any;
            status: any;
            version: any;
            case: {
                id: any;
                studentName: any;
                category: any;
                status: any;
            };
            staffName: any;
            leaseExpireAt: any;
        } | null;
    }[]>;
    static getOnlineDevicesByMode(mode: DeviceMode): Promise<{
        deviceId: any;
        name: any;
        mode: any;
        status: "OFFLINE" | "IDLE" | "BUSY";
        isOnline: boolean;
        lastSeenAt: any;
        currentLock: {
            id: any;
            status: any;
            version: any;
            case: {
                id: any;
                studentName: any;
                category: any;
                status: any;
            };
            staffName: any;
            leaseExpireAt: any;
        } | null;
    }[]>;
    static issueWsToken(deviceId: string): Promise<string>;
    static changeMode(deviceId: string, newMode: DeviceMode): Promise<{
        name: string;
        id: string;
        mode: import(".prisma/client").$Enums.DeviceMode;
        lastSeenAt: Date;
    }>;
    static unpair(deviceId: string): Promise<void>;
    static checkPairingStatus(deviceId: string): Promise<boolean>;
    static updateDeviceName(deviceId: string, newName: string): Promise<{
        success: boolean;
        device: {
            name: string;
            id: string;
            mode: import(".prisma/client").$Enums.DeviceMode;
            lastSeenAt: Date;
        };
    }>;
}
//# sourceMappingURL=device.service.d.ts.map