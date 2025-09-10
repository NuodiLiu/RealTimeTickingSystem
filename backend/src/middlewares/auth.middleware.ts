// src/middleware/auth.ts
import { Request, Response, NextFunction, RequestHandler } from "express";

import { AuthError, ForbiddenRoleError } from "../error";
import { validateDeviceApiKey } from "../lib/utils/auth";

export type Role = "ADMIN" | "STAFF";

const ROLE_RANK: Record<Role, number> = {
  STAFF: 1,
  ADMIN: 2,
};


export function requireRoleAtLeast(required: Role): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = (req as any).user as { id: string; role: Role } | undefined;
    if (!user) return next(new AuthError("Unauthorized", 401)); 
    
    if (!(user.role in ROLE_RANK)) {
      return next(new AuthError("Invalid user role", 401));
    }
    
    const ok = ROLE_RANK[user.role] >= ROLE_RANK[required];

    if (!ok) return next(new ForbiddenRoleError()); 
    next();
  };
}

export const requireStaff = requireRoleAtLeast("STAFF");
export const requireAdmin = requireRoleAtLeast("ADMIN");

export type AuthUser = {
  id: string;
  role: Role;
  employeeNo: string;
};

export type AuthDevice = {
  deviceId: string;
  device: any;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      device?: AuthDevice;
    }
  }
}

export async function requireDevice(req: Request, _res: Response, next: NextFunction) {
  try {
    const auth = req.header("Authorization") ?? req.header("authorization") ?? "";
    if (!auth) throw new AuthError("Missing Authorization header", 401);

    const { deviceId, device } = await validateDeviceApiKey(auth);
    req.device = { deviceId, device };

    next();
  } catch (err: any) {
    if (err instanceof AuthError) return next(err);
    return next(new AuthError("Invalid device credentials", 401));
  }
}
