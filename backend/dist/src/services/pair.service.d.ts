import { DeviceMode } from '../lib/utils/type';
export declare class PairService {
    static generateQR(): Promise<{
        qrUrl: string;
        pairingToken: string;
        sessionId: string;
        expiresAt: Date;
    }>;
    static completePairing(data: {
        pairingToken: string;
        deviceName: string;
        mode?: DeviceMode;
        deviceId?: string;
    }): Promise<{
        deviceId: string;
        deviceSecret: string;
        apiKey: string;
        wsToken: string;
        deviceName: string;
        mode: import(".prisma/client").$Enums.DeviceMode;
        wsEndpoint: string;
    }>;
}
//# sourceMappingURL=pair.service.d.ts.map