// src/middlewares/jwt-auth.middleware.ts
import { Request, Response, NextFunction, RequestHandler } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { AuthError } from "../error";
import { prisma } from "../lib/prisma";
import { staffService } from "../services/staff.service";
import { handleAuthError } from "../lib/auth-errors";

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
  typ?: string; // Token type ('staff' or 'device')
  deviceId?: string; // Device ID for device tokens
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

    if (jwtSecret) {
      // Always verify App JWT tokens with our secret
      decoded = jwt.verify(token, jwtSecret) as any;
    } else {
      throw new Error('JWT_SECRET not configured');
    }
    
    if (!decoded || typeof decoded !== 'object') {
      throw new Error('Invalid token format');
    }

    // Basic validation of required claims for App JWT
    if (!decoded.sub || !decoded.typ) {
      throw new Error('Missing required claims (sub, typ)');
    }

    // Validate token type (should be 'staff' or 'device')
    if (!['staff', 'device'].includes(decoded.typ)) {
      throw new Error(`Invalid token type. Expected 'staff' or 'device', got: ${decoded.typ}`);
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
 * @deprecated Use staffService.getOrCreateStaff() instead for consistency
 */
async function getOrCreateStaff(payload: JWTUserPayload): Promise<AuthenticatedUser> {
  // For App JWT tokens, we expect the staff to already exist
  // This is typically called for refresh scenarios
  if (!payload.identityKey) {
    throw new AuthError("identityKey is missing from JWT token", 400);
  }

  try {
    // Use the unified staff service for consistent lookup
    const staff = await staffService.findStaffById(payload.sub);
    
    if (!staff) {
      throw new AuthError("Staff record not found", 404);
    }

    return {
      id: staff.id,
      role: staff.role,
      employeeNo: staff.employeeNo,
      identityKey: staff.identityKey,
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
    const token = extractBearerToken(authHeader);
    
    if (!token) {
      throw new AuthError('Missing or invalid Authorization header', 401);
    }

    const jwtPayload = validateJWT(token);
    const user = await getOrCreateStaff(jwtPayload);
    
    req.user = user;
    next();
  } catch (error) {
    console.error('JWT Auth error:', error instanceof Error ? error.message : error);
    return handleAuthError(error, res);
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

/**
 * Unified JWT authentication middleware
 * Supports both device tokens (typ='device') and staff tokens (typ='staff')
 * Used for endpoints that need to support both iPad and Portal clients
 * 
 * Sets either req.device or req.user based on token type
 */
export async function requireJWTAuthUnified(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.header('Authorization');
    const token = extractBearerToken(authHeader);
    
    if (!token) {
      throw new AuthError('Missing or invalid Authorization header', 401);
    }

    const jwtPayload = validateJWT(token);
    
    // Handle device token (typ='device')
    if (jwtPayload.typ === 'device') {
      if (!jwtPayload.sub) {
        throw new AuthError('Device token missing sub (deviceId)', 401);
      }
      
      // Load device from database (sub contains deviceId for device tokens)
      const device = await prisma.kioskDevice.findUnique({
        where: { id: jwtPayload.sub }
      });
      
      if (!device) {
        throw new AuthError('Device not found', 404);
      }
      
      req.device = {
        deviceId: device.id,
        device: device
      };
      
      console.log('Unified JWT Auth: Device authenticated:', device.id);
      return next();
    }
    
    // Handle staff token (typ='staff')
    if (jwtPayload.typ === 'staff') {
      const user = await getOrCreateStaff(jwtPayload);
      req.user = user;
      
      console.log('Unified JWT Auth: Staff authenticated:', user.id);
      return next();
    }
    
    // Invalid token type
    throw new AuthError(`Invalid token type: ${jwtPayload.typ}`, 401);
    
  } catch (error) {
    console.error('Unified JWT Auth error:', error instanceof Error ? error.message : error);
    return handleAuthError(error, res);
  }
}
