import { Request, Response, NextFunction } from 'express';
import '../middlewares/auth.middleware';
export declare class DeviceController {
    static handleHeartbeat(req: Request, res: Response, next: NextFunction): Promise<void>;
    static getDeviceStatus(req: Request, res: Response, next: NextFunction): Promise<void>;
    static listDevices(req: Request, res: Response, next: NextFunction): Promise<void>;
    static getDevicesByMode(req: Request, res: Response, next: NextFunction): Promise<void>;
    static getOnlineDevicesByMode(req: Request, res: Response, next: NextFunction): Promise<void>;
    static issueWsToken(req: Request, res: Response, next: NextFunction): Promise<void>;
    static issueAppJWT(req: Request, res: Response, next: NextFunction): Promise<void>;
    static changeMode(req: Request, res: Response, next: NextFunction): Promise<void>;
    static unpairDevice(req: Request, res: Response, next: NextFunction): Promise<void>;
    static checkPairingStatus(req: Request, res: Response, next: NextFunction): Promise<void>;
    static updateDeviceName(req: Request, res: Response, next: NextFunction): Promise<void>;
}
//# sourceMappingURL=device.controller.d.ts.map