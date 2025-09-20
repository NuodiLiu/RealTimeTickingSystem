import { Request, Response, NextFunction, RequestHandler } from "express";
export type Role = "ADMIN" | "STAFF";
export type AuthUser = {
    id: string;
    role: Role;
    employeeNo: string;
};
export type AuthDevice = {
    deviceId: string;
    device: any;
};
export declare function requireRoleAtLeast(required: Role): RequestHandler;
export declare const requireStaff: RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
export declare const requireAdmin: RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
export declare function requireDevice(req: Request, _res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=auth.middleware.d.ts.map