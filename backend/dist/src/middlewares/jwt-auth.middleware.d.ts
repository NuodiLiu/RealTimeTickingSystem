import { Request, Response, NextFunction } from "express";
export interface AuthenticatedUser {
    id: string;
    role: "ADMIN" | "STAFF";
    employeeNo: string;
    identityKey: string;
}
declare global {
    namespace Express {
        interface Request {
            user?: AuthenticatedUser;
            device?: {
                deviceId: string;
                device: any;
            };
        }
    }
}
/**
 * Middleware to require JWT authentication
 */
export declare function requireJWTAuth(req: Request, res: Response, next: NextFunction): Promise<void>;
/**
 * Middleware to optionally authenticate with JWT (doesn't fail if no token)
 */
export declare function optionalJWTAuth(req: Request, res: Response, next: NextFunction): Promise<void>;
/**
 * Clear staff cache (useful for testing)
 */
export declare function clearStaffCache(): void;
//# sourceMappingURL=jwt-auth.middleware.d.ts.map