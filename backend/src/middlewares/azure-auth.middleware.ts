// src/middlewares/azure-auth.ts
import { Request, Response, NextFunction, RequestHandler } from "express";
import { prisma } from "../lib/prisma";
import { AuthError, BadRequestError } from "../error";

// verify only if logged in (session has user)
export function requireLogin(req: Request, _res: Response, next: NextFunction) {
  const logged = (req.session as any)?.user;
  if (!logged) throw new AuthError("Unauthorised", 401);
  next();
}

// optional enable to lock non unsw accounts
export function requireTenant(req: Request, _res: Response, next: NextFunction) {
  const u = (req.session as any)?.user;
  if (!u) throw new AuthError("Unauthorised", 401);
  const expected = process.env.AZURE_AD_TENANT_ID;
  if (expected && expected !== "common" && u.tid !== expected) {
    throw new AuthError("Forbidden (wrong tenant)", 403);
  }
  next();
}

// map sso sessions to staff members in system, populate req.user
// create staff upon first login
const STAFF_CACHE_TTL_MS = 5 * 60 * 1000;

export async function attachReqUser(req: Request, _res: Response, next: NextFunction) {
  try {
    const su = (req.session as any)?.user;
    if (!su) return next(new AuthError("Unauthorised", 401));

    if (process.env.NODE_ENV === 'development' && su.staffId && su.role && su.employeeNo) {
      req.user = { id: su.staffId, role: su.role, employeeNo: su.employeeNo };
      return next();
    }
    
    // session level cache, use directly if info exists 
    const cachedAt: number | undefined = (su as any)._staffCachedAt;
    if (su.staffId && su.role && su.employeeNo && cachedAt && Date.now() - cachedAt < STAFF_CACHE_TTL_MS) {
      req.user = { id: su.staffId, role: su.role, employeeNo: su.employeeNo };
      return next();
    }

    const identityKey: string | undefined = su.identityKey; 
    if (!identityKey) return next(new AuthError("Unauthorised", 401));

    const upn: string | null = su.upn ?? null;
    const displayName: string | null = su.name ?? null;

    if (!upn) {
      throw new BadRequestError("UPN (email) is missing from Azure token");
    }

    // one time upsert based on identityKey
    const staff = await prisma.staff.upsert({
      where: { identityKey },
      create: {
        identityKey,
        name: displayName ?? "New User",
        email: upn,
        // use placeholder for employeeNo 
        employeeNo: `ext-${(crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`)}`,
        role: "STAFF",
        password: "", // not using local passwords
      },
      update: {
        ...(displayName ? { name: displayName } : {}),
        ...(upn ? { email: upn } : {}),
      },
      select: { id: true, role: true, employeeNo: true },
    });

    // populate req.user + session cache
    (req.session as any).user.staffId = staff.id;
    (req.session as any).user.role = staff.role;    
    (req.session as any).user.employeeNo = staff.employeeNo;
    (req.session as any).user._staffCachedAt = Date.now();

    req.user = { id: staff.id, role: staff.role as any, employeeNo: staff.employeeNo };

    next();
  } catch (err) {
    next(err);
  }
}


export const requireAuth: RequestHandler[] = [
  requireLogin,    
  requireTenant,    
  attachReqUser,   
];

export const requireAuthAnyTenant: RequestHandler[] = [
  requireLogin,
  attachReqUser,
];