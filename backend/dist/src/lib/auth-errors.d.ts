/**
 * Authentication Error Types and Handlers
 *
 * This module provides standardized error handling for authentication flows
 * following OAuth 2.0 RFC 6749 and industry best practices.
 */
import { Response } from 'express';
export declare const AUTH_ERROR_CODES: {
    readonly INVALID_REQUEST: "invalid_request";
    readonly INVALID_TOKEN: "invalid_token";
    readonly INSUFFICIENT_SCOPE: "insufficient_scope";
    readonly INVALID_CLIENT: "invalid_client";
    readonly STAFF_NOT_FOUND: "staff_not_found";
    readonly AUTHENTICATION_FAILED: "authentication_failed";
    readonly TENANT_NOT_AUTHORIZED: "tenant_not_authorized";
    readonly MISSING_CLAIMS: "missing_claims";
    readonly INTERNAL_ERROR: "internal_error";
    readonly SERVICE_UNAVAILABLE: "service_unavailable";
};
export type AuthErrorCode = typeof AUTH_ERROR_CODES[keyof typeof AUTH_ERROR_CODES];
export interface AuthErrorResponse {
    error: AuthErrorCode;
    error_description: string;
    error_uri?: string;
}
/**
 * Send standardized OAuth 2.0 error response
 */
export declare function sendAuthError(res: Response, code: AuthErrorCode, description: string, statusCode?: number): Response;
/**
 * Handle authentication errors with appropriate HTTP responses
 */
export declare function handleAuthError(error: unknown, res: Response): Response;
/**
 * Validate required Azure AD claims
 */
export declare function validateAzureAdClaims(claims: any): void;
/**
 * Retry wrapper for database operations to handle temporary failures
 */
export declare function withRetry<T>(operation: () => Promise<T>, maxRetries?: number, delayMs?: number): Promise<T>;
//# sourceMappingURL=auth-errors.d.ts.map