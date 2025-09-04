// src/middleware/auth.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export type AuthUser = {
  id: string;
  role: "staff" | "STAFF" | "admin" | "ADMIN";
  employeeNo: string;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const hdr = req.header("Authorization");
  if (!hdr || !hdr.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing Authorization" });
  }
  const token = hdr.slice("Bearer ".length);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as any;
    req.user = {
      id: payload.sub,
      role: payload.role,
      employeeNo: payload.emp,
    };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

export function requireAdminOrOwner(getOwnerId: (req: Request) => Promise<string | null>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const isAdmin = String(req.user.role).toUpperCase() === "ADMIN";
    if (isAdmin) return next();

    const ownerId = await getOwnerId(req);
    if (ownerId && ownerId === req.user.id) return next();

    return res.status(403).json({ error: "Forbidden" });
  };
}
