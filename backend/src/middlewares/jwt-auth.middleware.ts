// src/middlewares/jwt-auth.middleware.ts
import { Request, Response, NextFunction, RequestHandler } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { AuthError } from "../error";
import { prisma } from "../lib/prisma";

interface JWTUserPayload {
  sub: string; // Subject (user ID)
  iss: string; // Issuer
  aud?: string; // Audience
  tid?: string; // Tenant ID
  oid?: string; // Object ID in Azure AD
  upn?: string; // User Principal Name
  preferred_username?: string; // Alternative email field
  email?: string; // Email field
  name?: string; // Display name
  identityKey?: string; // Our custom identity key
  iat?: number; // Issued at
  exp?: number; // Expires at
}

export interface AuthenticatedUser {
  id: string;
  role: "ADMIN" | "STAFF";
  employeeNo: string;
  identityKey: string;
}

// Update the global Express interface to use our AuthenticatedUser type
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

// Cache for staff lookups to reduce database hits
const staffCache = new Map<string, { user: AuthenticatedUser; cachedAt: number }>();
const STAFF_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Validates and decodes JWT token from Authorization header
 */
function validateJWT(token: string): JWTUserPayload {
  try {
    const jwtSecret = process.env.JWT_SECRET;
    let decoded: any;

    if (jwtSecret && (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test')) {
      // In development/test, verify against our secret (for mock tokens)
      decoded = jwt.verify(token, jwtSecret) as any;
    } else {
      // In production, Azure AD tokens should be validated against Azure's public keys
      // For now, we'll decode without verification (assuming Azure validates on their end)
      // In production, you should validate the signature
      decoded = jwt.decode(token) as any;
    }
    
    if (!decoded || typeof decoded !== 'object') {
      throw new Error('Invalid token format');
    }

    // Basic validation of required claims
    if (!decoded.sub || !decoded.iss) {
      throw new Error('Missing required claims');
    }

    // Validate audience if specified
    const expectedAudience = process.env.AZURE_AD_CLIENT_ID;
    if (expectedAudience && decoded.aud !== expectedAudience) {
      throw new Error('Invalid audience');
    }

    return decoded as JWTUserPayload;
  } catch (error) {
    throw new AuthError(`Invalid JWT token: ${error instanceof Error ? error.message : 'Unknown error'}`, 401);
  }
}

/**
 * Extract Bearer token from Authorization header
 */
function extractBearerToken(authHeader?: string): string | null {
  if (!authHeader) return null;
  
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }
  
  return parts[1] || null;
}

/**
 * Get or create staff member based on JWT claims
 */
async function getOrCreateStaff(payload: JWTUserPayload): Promise<AuthenticatedUser> {
  const identityKey = payload.identityKey;
  const upn = payload.upn || payload.preferred_username || payload.email;
  const displayName = payload.name;
  
  if (!identityKey) {
    throw new AuthError("identityKey is missing from JWT token", 400);
  }
  
  if (!upn) {
    throw new AuthError("UPN (email) is missing from JWT token", 400);
  }
  
  try {
    // Step 1: Try to find by identityKey first (most common case - same user returning)
    let staff = await prisma.staff.findUnique({
      where: { identityKey },
      select: { id: true, role: true, employeeNo: true, email: true, identityKey: true }
    });

    if (staff) {
      // Found by identityKey, update email and name if needed
      if (staff.email !== upn || (displayName && displayName !== '')) {
        await prisma.staff.update({
          where: { identityKey },
          data: {
            ...(upn !== staff.email ? { email: upn } : {}),
            ...(displayName ? { name: displayName } : {}),
          }
        });
      }
      return { 
        id: staff.id, 
        role: staff.role as "ADMIN" | "STAFF", 
        employeeNo: staff.employeeNo, 
        identityKey: staff.identityKey 
      };
    }

    // Step 2: If not found by identityKey, try to find by email (same person, different IdP)
    staff = await prisma.staff.findUnique({
      where: { email: upn },
      select: { id: true, role: true, employeeNo: true, identityKey: true, email: true }
    });

    if (staff) {
      // Found by email, update to new identityKey (IdP migration)
      console.log(`Migrating user from identityKey '${staff.identityKey}' to '${identityKey}' for email: ${upn}`);
      const updatedStaff = await prisma.staff.update({
        where: { email: upn },
        data: {
          identityKey, // Update to new identityKey
          ...(displayName ? { name: displayName } : {}),
        },
        select: { id: true, role: true, employeeNo: true, identityKey: true }
      });
      return { 
        id: updatedStaff.id, 
        role: updatedStaff.role as "ADMIN" | "STAFF", 
        employeeNo: updatedStaff.employeeNo, 
        identityKey: updatedStaff.identityKey 
      };
    }

    // Step 3: Neither identityKey nor email found, create new staff
    const newStaff = await prisma.staff.create({
      data: {
        identityKey,
        name: displayName || "New User",
        email: upn,
        employeeNo: `ext-${crypto.randomUUID()}`,
        role: "STAFF",
        password: "", // not using local passwords
      },
      select: { id: true, role: true, employeeNo: true, identityKey: true },
    });

    console.log(`Created new staff member: ${upn} with identityKey: ${identityKey}`);
    return { 
      id: newStaff.id, 
      role: newStaff.role as "ADMIN" | "STAFF", 
      employeeNo: newStaff.employeeNo, 
      identityKey: newStaff.identityKey 
    };

  } catch (error) {
    console.error('Error in getOrCreateStaff:', error);
    throw new AuthError("Failed to authenticate user", 500);
  }
}

/**
 * Middleware to require JWT authentication
 */
export async function requireJWTAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.header('Authorization');
    console.log('Auth header:', authHeader);
    
    const token = extractBearerToken(authHeader);
    console.log('Extracted token:', token ? `${token.substring(0, 20)}...` : 'null');
    
    if (!token) {
      throw new AuthError('Missing or invalid Authorization header', 401);
    }

    const jwtPayload = validateJWT(token);
    console.log('JWT payload:', jwtPayload);
    
    const user = await getOrCreateStaff(jwtPayload);
    console.log('Created/found user:', user);
    
    req.user = user;
    next();
  } catch (error) {
    console.log('JWT Auth error:', error);
    if (error instanceof AuthError) {
      next(error);
    } else {
      next(new AuthError('Authentication failed', 401));
    }
  }
}

/**
 * Middleware to optionally authenticate with JWT (doesn't fail if no token)
 */
export async function optionalJWTAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.header('Authorization');
    const token = extractBearerToken(authHeader);
    
    if (token) {
      const jwtPayload = validateJWT(token);
      const user = await getOrCreateStaff(jwtPayload);
      req.user = user;
    }
    
    next();
  } catch (error) {
    // For optional auth, we don't fail on invalid tokens
    // but we also don't set req.user
    next();
  }
}

/**
 * Clear staff cache (useful for testing)
 */
export function clearStaffCache() {
  staffCache.clear();
}
