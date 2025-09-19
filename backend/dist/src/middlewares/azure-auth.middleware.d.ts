import { Request, Response, NextFunction, RequestHandler } from "express";
export declare function requireLogin(req: Request, _res: Response, next: NextFunction): void;
export declare function requireTenant(req: Request, _res: Response, next: NextFunction): void;
export declare function attachReqUser(req: Request, _res: Response, next: NextFunction): Promise<void>;
export declare const requireAuth: RequestHandler[];
export declare const requireAuthAnyTenant: RequestHandler[];
//# sourceMappingURL=azure-auth.middleware.d.ts.map