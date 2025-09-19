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
declare global {
    namespace Express {
        interface Request {
            azureAuth?: {
                tid: string;
                oid: string;
                identityKey: string;
                email?: string;
                name?: string;
                upn?: string;
                scopes: string[];
                roles: string[];
                iss: string;
                aud: string;
                exp: number;
                iat: number;
            };
        }
    }
}
/**
 * Main Azure AD JWT verification middleware
 */
export declare function verifyAzureJWT(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Require specific OAuth2 scopes
 */
export declare function requireScopes(requiredScopes: string[]): (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
/**
 * Require specific Azure AD app roles
 */
export declare function requireAppRoles(requiredRoles: string[]): (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
/**
 * Optional authentication - doesn't fail if no token
 */
export declare function optionalAzureJWT(req: Request, res: Response, next: NextFunction): Promise<void>;
/**
 * Clear JWKS cache (useful for testing)
 */
export declare function clearJWKSCache(): void;
//# sourceMappingURL=azure-auth.middleware.d.ts.map