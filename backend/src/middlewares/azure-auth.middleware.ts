/**
 * Enterprise-grade Azure AD JWT Authentication Middleware
 * 
 * This middleware provides:
 * - Proper JWT signature verification using JWKS
 * - Multi-tenant support with whitelist validation
 * - Stable identity keys using tid+oid
 * - Scope and role-based authorization
 * - Security best practices and error handling
 */

import { Request, Response, NextFunction } from 'express';
import { jwtVerify, createRemoteJWKSet, JWTPayload } from 'jose';

// Environment variables with defaults
const API_AUDIENCE = process.env.AZURE_AD_API_CLIENT_ID!;
const ALLOW_ANY_TENANT = process.env.AZURE_AD_ALLOW_ANY_TENANT === 'true';
const ALLOWED_TENANTS = ALLOW_ANY_TENANT ? [] : [
  process.env.AZURE_AD_UNSW_TENANT_ID!,
  '9188040d-6c67-4c5b-b112-36a304b66dad', // Personal Microsoft accounts
].filter(Boolean);

// Debug logging
console.log('Azure Auth Config:', {
  API_AUDIENCE,
  ALLOW_ANY_TENANT,
  ALLOWED_TENANTS,
  hasApiClientId: !!process.env.AZURE_AD_API_CLIENT_ID
});

// Cache JWKS to reduce network calls
const JWKS_CACHE = new Map<string, any>();
const JWKS_CACHE_TTL = 60 * 60 * 1000; // 1 hour

// Extend Express Request with Azure AD auth context
declare global {
  namespace Express {
    interface Request {
      azureAuth?: {
        // Core identity
        tid: string;         // Tenant ID
        oid: string;         // Object ID (user's unique ID in tenant)
        identityKey: string; // Stable key: aad:{tid}:{oid}
        
        // User info
        email?: string;
        name?: string;
        upn?: string;       // User Principal Name
        
        // Authorization
        scopes: string[];   // Delegated permissions (scp claim)
        roles: string[];    // App roles assigned to user
        
        // Metadata
        iss: string;        // Token issuer
        aud: string;        // Token audience
        exp: number;        // Expiration timestamp
        iat: number;        // Issued at timestamp
      };
    }
  }
}

interface AzureJWTClaims extends JWTPayload {
  tid: string;           // Tenant ID
  oid: string;           // Object ID
  iss: string;           // Issuer
  aud: string | string[]; // Audience
  scp?: string;          // Scopes (space-separated)
  roles?: string[];      // App roles
  email?: string;        // Email
  upn?: string;          // User Principal Name
  preferred_username?: string;
  name?: string;         // Display name
  exp: number;
  iat: number;
  nbf?: number;          // Not before
}

/**
 * Get JWKS URI for given issuer
 */
function getJwksUri(issuer: string): string {
  try {
    const url = new URL(issuer);
    if (url.hostname !== 'login.microsoftonline.com') {
      throw new Error('Invalid issuer hostname');
    }
    return `${issuer}/discovery/v2.0/keys`;
  } catch {
    throw new Error('Invalid issuer URL format');
  }
}

/**
 * Validate Azure AD issuer format and tenant
 */
function validateIssuer(iss: string, expectedTid: string): boolean {
  try {
    const url = new URL(iss);
    
    // Must be Microsoft login endpoint
    if (url.hostname !== 'login.microsoftonline.com') {
      return false;
    }
    
    // Must be v2.0 endpoint
    if (!url.pathname.endsWith('/v2.0')) {
      return false;
    }
    
    // Extract tenant from issuer path
    const pathParts = url.pathname.split('/').filter(Boolean);
    const issuerTenant = pathParts[0]; // Should be tenant ID or "common"
    
    // Allow specific tenant, "common" endpoint, or "organizations" endpoint
    return issuerTenant === expectedTid || 
           issuerTenant === 'common' || 
           issuerTenant === 'organizations';
  } catch {
    return false;
  }
}

/**
 * Create stable identity key from tenant and object ID
 */
function createIdentityKey(tid: string, oid: string): string {
  return `aad:${tid}:${oid}`;
}

/**
 * Parse space-separated scopes string
 */
function parseScopes(scp?: string): string[] {
  if (!scp || typeof scp !== 'string') return [];
  return scp.split(' ').filter(scope => scope.length > 0);
}

/**
 * Get or create cached JWKS for issuer
 */
async function getJWKS(issuer: string): Promise<any> {
  const cacheKey = issuer;
  const cached = JWKS_CACHE.get(cacheKey);
  
  if (cached && (Date.now() - cached.timestamp) < JWKS_CACHE_TTL) {
    return cached.jwks;
  }
  
  const jwksUri = getJwksUri(issuer);
  const jwks = createRemoteJWKSet(new URL(jwksUri));
  
  JWKS_CACHE.set(cacheKey, {
    jwks,
    timestamp: Date.now()
  });
  
  return jwks;
}

/**
 * Main Azure AD JWT verification middleware
 */
export async function verifyAzureJWT(req: Request, res: Response, next: NextFunction) {
  try {
    // Extract Authorization header
    const authHeader = req.header('authorization') || req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'invalid_request',
        error_description: 'Missing or malformed Authorization header'
      }).header('WWW-Authenticate', 'Bearer realm="api"');
    }

    const token = authHeader.slice(7); // Remove 'Bearer '
    if (!token) {
      return res.status(401).json({
        error: 'invalid_token',
        error_description: 'Empty bearer token'
      }).header('WWW-Authenticate', 'Bearer realm="api", error="invalid_token"');
    }

    // Quick decode to extract issuer and basic claims (before expensive verification)
    let previewClaims: any;
    try {
      const parts = token.split('.');
      if (parts.length !== 3) throw new Error('Invalid JWT format');
      
      const payloadPart = parts[1];
      if (!payloadPart) throw new Error('Missing payload');
      
      previewClaims = JSON.parse(Buffer.from(payloadPart, 'base64url').toString());
    } catch {
      return res.status(401).json({
        error: 'invalid_token',
        error_description: 'Malformed JWT token'
      }).header('WWW-Authenticate', 'Bearer realm="api", error="invalid_token"');
    }

    const { iss, tid, oid } = previewClaims;

    // Validate required claims
    if (!iss || !tid || !oid) {
      return res.status(401).json({
        error: 'invalid_token',
        error_description: 'Missing required claims (iss, tid, oid)'
      }).header('WWW-Authenticate', 'Bearer realm="api", error="invalid_token"');
    }

    // Validate tenant whitelist (skip if ALLOW_ANY_TENANT is enabled)
    if (!ALLOW_ANY_TENANT && !ALLOWED_TENANTS.includes(tid)) {
      return res.status(401).json({
        error: 'invalid_token',
        error_description: 'Tenant not authorized'
      }).header('WWW-Authenticate', 'Bearer realm="api", error="invalid_token"');
    }

    // Validate issuer format
    if (!validateIssuer(iss, tid)) {
      return res.status(401).json({
        error: 'invalid_token',
        error_description: 'Invalid issuer'
      }).header('WWW-Authenticate', 'Bearer realm="api", error="invalid_token"');
    }

    // Get JWKS and verify token signature
    const jwks = await getJWKS(iss);
    
    console.log('JWT Verification:', {
      tokenAudience: previewClaims.aud,
      expectedAudience: API_AUDIENCE,
      tokenIssuer: iss,
      tokenTenant: tid
    });
    
    const { payload } = await jwtVerify(token, jwks, {
      audience: API_AUDIENCE,
      issuer: iss,
      clockTolerance: 300, // 5 minutes
    }) as { payload: AzureJWTClaims };

    // Extract user information
    const identityKey = createIdentityKey(payload.tid, payload.oid);
    const scopes = parseScopes(payload.scp);
    const roles = Array.isArray(payload.roles) ? payload.roles : [];
    
    // Determine email from various claims
    const email = payload.email || payload.upn || payload.preferred_username;
    
    // Extract audience - handle both string and array formats
    let audience: string;
    if (Array.isArray(payload.aud)) {
      audience = payload.aud[0] || '';
    } else {
      audience = payload.aud || '';
    }

    // Build auth context with explicit undefined handling
    const authContext: any = {
      tid: payload.tid,
      oid: payload.oid,
      identityKey,
      scopes,
      roles,
      iss: payload.iss,
      aud: audience,
      exp: payload.exp,
      iat: payload.iat,
    };

    // Only add optional fields if they have values
    if (email) authContext.email = email;
    if (payload.name) authContext.name = payload.name;
    if (payload.upn) authContext.upn = payload.upn;

    // Inject auth context into request
    req.azureAuth = authContext;

    next();
  } catch (error: any) {
    console.error('Azure JWT verification failed:', {
      message: error.message,
      code: error.code,
      // Don't log the full token for security
    });

    let errorCode = 'invalid_token';
    let description = 'Token verification failed';

    // Map jose errors to OAuth2 error codes
    if (error.code === 'ERR_JWT_EXPIRED') {
      errorCode = 'invalid_token';
      description = 'Token has expired';
    } else if (error.code === 'ERR_JWS_INVALID') {
      errorCode = 'invalid_token';
      description = 'Invalid token signature';
    } else if (error.code === 'ERR_JWT_AUDIENCE_INVALID') {
      errorCode = 'invalid_token';
      description = 'Invalid token audience';
    }

    return res.status(401).json({
      error: errorCode,
      error_description: description
    }).header('WWW-Authenticate', `Bearer realm="api", error="${errorCode}"`);
  }
}

/**
 * Require specific OAuth2 scopes
 */
export function requireScopes(requiredScopes: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.azureAuth) {
      return res.status(401).json({
        error: 'unauthorized',
        error_description: 'Authentication required'
      });
    }

    const userScopes = req.azureAuth.scopes;
    const hasScope = requiredScopes.some(scope => userScopes.includes(scope));

    if (!hasScope) {
      return res.status(403).json({
        error: 'insufficient_scope',
        error_description: 'Token lacks required scope',
        required_scopes: requiredScopes
      }).header('WWW-Authenticate', 
        `Bearer realm="api", error="insufficient_scope", scope="${requiredScopes.join(' ')}"`
      );
    }

    next();
  };
}

/**
 * Require specific Azure AD app roles
 */
export function requireAppRoles(requiredRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.azureAuth) {
      return res.status(401).json({
        error: 'unauthorized',
        error_description: 'Authentication required'
      }).header('WWW-Authenticate', 'Bearer realm="api", error="invalid_token"');
    }

    const userRoles = req.azureAuth.roles;
    const hasRole = requiredRoles.some(role => userRoles.includes(role));

    if (!hasRole) {
      return res.status(403).json({
        error: 'insufficient_permissions',
        error_description: 'User lacks required role',
        required_roles: requiredRoles
      }).header('WWW-Authenticate', 
        `Bearer realm="api", error="insufficient_scope", scope="${requiredRoles.join(' ')}"`
      );
    }

    next();
  };
}

/**
 * Optional authentication - doesn't fail if no token
 */
export async function optionalAzureJWT(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.header('authorization') || req.header('Authorization');
  
  if (!authHeader?.startsWith('Bearer ')) {
    return next(); // No token, continue without auth
  }
  
  // Has token, try to verify it
  verifyAzureJWT(req, res, (err) => {
    if (err) {
      // Token present but invalid - this might be intentional for optional auth
      // You could either fail here or continue without auth based on your needs
      return next(); // Continue without auth on verification failure
    }
    next();
  });
}

/**
 * Clear JWKS cache (useful for testing)
 */
export function clearJWKSCache() {
  JWKS_CACHE.clear();
}
