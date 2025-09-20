// src/app/lib/env-utils.ts
/**
 * Environment detection and URL utilities for multi-domain support
 */

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function getApiBaseUrl(): string {
  if (isProduction()) {
    return process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.ticketing-system.com';
  }
  return process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.localhost';
}

export function getAppUrl(): string {
  if (isProduction()) {
    return process.env.NEXT_PUBLIC_APP_URL || 'https://ticketing-system.com';
  }
  return process.env.NEXT_PUBLIC_APP_URL || 'https://app.localhost';
}

export function getRedirectUri(): string {
  const appUrl = getAppUrl();
  return `${appUrl}/auth/redirect`;
}

export function getPostLogoutRedirectUri(): string {
  const appUrl = getAppUrl();
  return appUrl;
}

/**
 * Check if the current domain is secure (HTTPS)
 */
export function isSecureDomain(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.protocol === 'https:';
}

/**
 * Get the current domain for cookie configuration
 */
export function getCurrentDomain(): string {
  if (typeof window === 'undefined') return '';
  return window.location.hostname;
}

/**
 * Get cookie configuration based on environment
 */
export function getCookieConfig() {
  const isSecure = isSecureDomain();
  const domain = getCurrentDomain();
  
  return {
    secure: isSecure,
    sameSite: isSecure ? 'none' as const : 'lax' as const,
    domain: isProduction() ? domain : undefined, // Use domain in production for cross-subdomain
  };
}
