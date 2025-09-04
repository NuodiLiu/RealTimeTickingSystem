import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// Extend Express request type to carry user
declare global {
  namespace Express {
    interface User {
      id: string;
      name?: string | undefined;
      email?: string | undefined;
    }
    interface Request {
      user?: User;
    }
  }
}

function verifyStaffJwt(token: string) {
  return jwt.verify(token, process.env.JWT_SECRET as string) as {
    id: string;
    name?: string;
    email?: string;
  };
}

export function requireStaff(req: Request, res: Response, next: NextFunction) {
  try {
    const cookieToken = req.cookies?.auth as string | undefined;
    const authHeader = req.header("Authorization") || "";
    const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
    const token = cookieToken || bearer;

    if (!token) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const decoded = verifyStaffJwt(token);
    req.user = { id: decoded.id, name: decoded.name, email: decoded.email };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid/expired session" });
  }
}