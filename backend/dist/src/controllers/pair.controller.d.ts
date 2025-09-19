import { Request, Response, NextFunction } from 'express';
type DeviceStatus = 'OFFLINE' | 'IDLE' | 'BUSY';
type DeviceMode = 'REGISTRATION' | 'FEEDBACK';
export type DeviceWithStatus = {
    deviceId: string;
    name: string;
    mode: DeviceMode;
    status: DeviceStatus;
    isOnline: boolean;
    lastSeenAt: Date;
    currentLock: {
        id: string;
        status: string;
        case: {
            id: string;
            studentName: string;
            category: string;
            status: string;
        };
        staffName: string;
        leaseExpireAt: Date;
    } | null;
};
export declare class PairController {
    static generateQR(req: Request, res: Response, next: NextFunction): Promise<void>;
    static completePairing(req: Request, res: Response, next: NextFunction): Promise<void>;
}
export {};
//# sourceMappingURL=pair.controller.d.ts.map