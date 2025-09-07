// src/middleware/auth.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AuthError } from "../error";
import { PairService } from "../services/pair.service";

export type AuthUser = {
  id: string;
  role: "ADMIN" | "STAFF";
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
      role: String(payload.role || "STAFF").toUpperCase() as "ADMIN" | "STAFF",
      employeeNo: payload.emp,
    };
    next();
  } catch {
    throw new AuthError("Invalid token", 401);
  }
}

export function requireAdminOrOwner(getOwnerId: (req: Request) => Promise<string | null>) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new AuthError("Unauthorized", 401);

    const isAdmin = req.user.role === "ADMIN";
    if (isAdmin) return next();

    const ownerId = await getOwnerId(req);
    if (ownerId && ownerId === req.user.id) return next();

    throw new AuthError("Forbidden", 403);
  };
}

export function requireRole(role: "ADMIN" | "STAFF") {
  return function (req: any , res: any, next: any) {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}

export function requireDevice(req: Request, res: Response, next: NextFunction) {
  const hdr = req.header('Authorisation');
  if (!hdr?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing device credentials" });
  }
  const token = hdr.slice("Bearer ".length);

  PairService.validateDeviceCredentials(token)
    .then(deviceAuth => {
      req.device = deviceAuth;
      next();
    }).catch(error => {
      res.status(401).json({ error: error.message });
    });
}
export const requireStaff = requireRole("STAFF");
export const requireAdmin = requireRole("ADMIN");


