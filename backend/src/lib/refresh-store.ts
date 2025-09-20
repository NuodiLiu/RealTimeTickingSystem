// src/lib/refresh-store.ts
import crypto from "crypto";

/**
 * Refresh token storage structure
 */
export interface RefreshTokenData {
  msalAccount: any; // MSAL account object
  providerRefresh: string; // Microsoft refresh token
  staffId: string;
  tokenVersion: number;
  exp: number; // Expiration timestamp
  identityKey: string;
  expiresAt?: number; // Internal expiry for cleanup
}

/**
 * In-memory store for refresh tokens (for development)
 * In production, replace with Redis/Azure Cache for Redis
 */
class RefreshTokenStore {
  private store = new Map<string, RefreshTokenData>();

  /**
   * Generate a secure random refresh handle
   */
  generateHandle(): string {
    return crypto.randomBytes(32).toString('base64url'); // 256-bit random handle
  }

  /**
   * Store refresh token data with TTL
   */
  async set(handle: string, data: RefreshTokenData, ttlSeconds: number = 14 * 24 * 60 * 60): Promise<void> {
    // Add expiration time
    const expiresAt = Date.now() + (ttlSeconds * 1000);
    const dataWithExpiry = { ...data, expiresAt };
    
    this.store.set(handle, dataWithExpiry);
    
    // Auto-cleanup expired entries
    setTimeout(() => {
      this.store.delete(handle);
    }, ttlSeconds * 1000);
  }

  /**
   * Get refresh token data by handle
   */
  async get(handle: string): Promise<RefreshTokenData | null> {
    const data = this.store.get(handle);
    
    if (!data) return null;
    
    // Check if expired
    if (data.expiresAt && Date.now() > data.expiresAt) {
      this.store.delete(handle);
      return null;
    }
    
    return data;
  }

  /**
   * Delete refresh token data (handle rotation)
   */
  async delete(handle: string): Promise<void> {
    this.store.delete(handle);
  }

  /**
   * Rotate handle: create new one and delete old one
   */
  async rotateHandle(oldHandle: string, newData: RefreshTokenData, ttlSeconds: number = 14 * 24 * 60 * 60): Promise<string> {
    const newHandle = this.generateHandle();
    await this.set(newHandle, newData, ttlSeconds);
    await this.delete(oldHandle);
    return newHandle;
  }
}

// Singleton instance
export const refreshStore = new RefreshTokenStore();

/**
 * Cookie options for refresh handle
 */
export const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production', // HTTPS only in production
  sameSite: 'none' as const, // Required for cross-origin requests
  path: '/auth/refresh', // Restrict to refresh endpoint only
  maxAge: 14 * 24 * 60 * 60 * 1000, // 14 days in milliseconds
} as const;

export const REFRESH_COOKIE_NAME = '__Host-app_rf';
