// src/middleware/auth.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AuthError } from "../error";
import { validateDeviceApiKey } from "../lib/utils/auth";

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

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      device?: AuthDevice;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const hdr = req.header("Authorization");
  if (!hdr?.startsWith("Bearer ")) {
    throw new AuthError("Missing Authorization", 401);
  }

  const token = hdr.slice("Bearer ".length);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as any;
    req.user = {
      id: payload.sub,
      role: String(payload.role || "STAFF").toUpperCase() as Role,
      employeeNo: payload.emp,
    };
    next();
  } catch {
    throw new AuthError("Invalid token", 401);
  }
}

const ROLE_ORDER: Record<Role, number> = { STAFF: 1, ADMIN: 2 };
function hasAtLeast(userRole: Role, required: Role) {
  return ROLE_ORDER[userRole] >= ROLE_ORDER[required];
}

export function requireAtLeast(role: Role) {
  return function (req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        requireAuth(req, res, (err?: any) => {
          if (err) return next(err);
        });
      }

      if (!req.user) throw new AuthError("Unauthorized", 401);
      if (!hasAtLeast(req.user.role, role)) throw new AuthError("Forbidden", 403);
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function requireExact(role: Role) {
  return function (req: Request, _res: Response, next: NextFunction) {
    if (!req.user) throw new AuthError("Unauthorized", 401);
    if (req.user.role !== role) throw new AuthError("Forbidden", 403);
    next();
  };
}

export const requireStaff = requireAtLeast("STAFF"); // ADMIN can pass
export const requireAdmin = requireAtLeast("ADMIN");

export function requireAdminOrOwner(getOwnerId: (req: Request) => Promise<string | null>) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new AuthError("Unauthorized", 401);
    if (hasAtLeast(req.user.role, "ADMIN")) return next();

    const ownerId = await getOwnerId(req);
    if (ownerId && ownerId === req.user.id) return next();

    throw new AuthError("Forbidden", 403);
  };
}

export async function requireDevice(req: Request, _res: Response, next: NextFunction) {
  try {
    const auth = req.header("Authorization") ?? req.header("authorization") ?? "";
    if (!auth) throw new AuthError("Missing Authorization header", 401);

    const { deviceId, device } = await validateDeviceApiKey(auth);
    req.device = { deviceId, device };

    next();
  } catch (err: any) {
    next(err instanceof Error ? err : new AuthError("Invalid device credentials", 401));
  }
}
