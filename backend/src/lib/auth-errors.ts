/**
 * Authentication Error Types and Handlers
 * 
 * This module provides standardized error handling for authentication flows
 * following OAuth 2.0 RFC 6749 and industry best practices.
 */

import { Response } from 'express';
import { AuthError } from '../error';

// OAuth 2.0 standard error codes
export const AUTH_ERROR_CODES = {
  // Standard OAuth 2.0 errors
  INVALID_REQUEST: 'invalid_request',
  INVALID_TOKEN: 'invalid_token', 
  INSUFFICIENT_SCOPE: 'insufficient_scope',
  INVALID_CLIENT: 'invalid_client',
  
  // Custom application errors
  STAFF_NOT_FOUND: 'staff_not_found',
  AUTHENTICATION_FAILED: 'authentication_failed',
  TENANT_NOT_AUTHORIZED: 'tenant_not_authorized',
  MISSING_CLAIMS: 'missing_claims',
  
  // System errors
  INTERNAL_ERROR: 'internal_error',
  SERVICE_UNAVAILABLE: 'service_unavailable',
} as const;

export type AuthErrorCode = typeof AUTH_ERROR_CODES[keyof typeof AUTH_ERROR_CODES];

// Standard error response interface
export interface AuthErrorResponse {
  error: AuthErrorCode;
  error_description: string;
  error_uri?: string;
}

/**
 * Send standardized OAuth 2.0 error response
 */
export function sendAuthError(
  res: Response, 
  code: AuthErrorCode, 
  description: string, 
  statusCode: number = 401
): Response {
  const response: AuthErrorResponse = {
    error: code,
    error_description: description,
  };

  // Add WWW-Authenticate header for 401 responses
  if (statusCode === 401) {
    res.header('WWW-Authenticate', `Bearer realm="api", error="${code}"`);
  }

  return res.status(statusCode).json(response);
}

/**
 * Handle authentication errors with appropriate HTTP responses
 */
export function handleAuthError(error: unknown, res: Response): Response {
  console.error('Authentication error:', {
    message: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined,
  });

  if (error instanceof AuthError) {
    // Map AuthError to appropriate OAuth 2.0 error codes
    switch (error.statusCode) {
      case 400:
        return sendAuthError(res, AUTH_ERROR_CODES.INVALID_REQUEST, error.message, 400);
      case 401:
        return sendAuthError(res, AUTH_ERROR_CODES.INVALID_TOKEN, error.message, 401);
      case 403:
        return sendAuthError(res, AUTH_ERROR_CODES.INSUFFICIENT_SCOPE, error.message, 403);
      case 404:
        return sendAuthError(res, AUTH_ERROR_CODES.STAFF_NOT_FOUND, error.message, 404);
      default:
        return sendAuthError(res, AUTH_ERROR_CODES.INTERNAL_ERROR, 'Authentication failed', 500);
    }
  }

  // Handle Prisma errors
  if (error && typeof error === 'object' && 'code' in error) {
    const prismaError = error as any;
    
    if (prismaError.code === 'P2002') {
      // Unique constraint violation
      return sendAuthError(
        res, 
        AUTH_ERROR_CODES.AUTHENTICATION_FAILED, 
        'User account conflict - please try again', 
        409
      );
    }
    
    if (prismaError.code === 'P2025') {
      // Record not found
      return sendAuthError(
        res, 
        AUTH_ERROR_CODES.STAFF_NOT_FOUND, 
        'User account not found', 
        404
      );
    }
  }

  // Generic error fallback
  return sendAuthError(
    res, 
    AUTH_ERROR_CODES.INTERNAL_ERROR, 
    'Internal authentication error', 
    500
  );
}

/**
 * Validate required Azure AD claims
 */
export function validateAzureAdClaims(claims: any): void {
  const requiredClaims = ['iss', 'sub', 'tid', 'oid'];
  const missingClaims = requiredClaims.filter(claim => !claims[claim]);
  
  if (missingClaims.length > 0) {
    throw new AuthError(
      `Missing required Azure AD claims: ${missingClaims.join(', ')}`, 
      400
    );
  }
}

/**
 * Retry wrapper for database operations to handle temporary failures
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 100
): Promise<T> {
  let lastError: unknown;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Don't retry on authentication errors
      if (error instanceof AuthError) {
        throw error;
      }
      
      // Don't retry on final attempt
      if (attempt === maxRetries) {
        break;
      }
      
      // Exponential backoff
      const delay = delayMs * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}
