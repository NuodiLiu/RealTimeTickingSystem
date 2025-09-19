import { Request, Response, NextFunction } from 'express';
import { AuthedDevice } from './types';
export interface SignalRAuthRequest extends Omit<Request, 'device'> {
    device?: AuthedDevice;
    userId?: string;
}
export declare function generateSignalRToken(device: AuthedDevice): Promise<string>;
export declare function generateDashboardToken(userId: string): Promise<string>;
export declare function verifySignalRToken(token: string): {
    deviceId?: string;
    userId?: string;
    mode?: string;
    type: string;
} | null;
export declare function signalRAuthMiddleware(req: SignalRAuthRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
export declare function getDeviceConnectionUrl(req: SignalRAuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function getDashboardConnectionUrl(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=auth.d.ts.map