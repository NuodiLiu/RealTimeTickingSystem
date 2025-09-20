"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.REFRESH_COOKIE_NAME = exports.REFRESH_COOKIE_OPTIONS = exports.refreshStore = void 0;
// src/lib/refresh-store.ts
const crypto_1 = __importDefault(require("crypto"));
/**
 * In-memory store for refresh tokens (for development)
 * In production, replace with Redis/Azure Cache for Redis
 */
class RefreshTokenStore {
    constructor() {
        this.store = new Map();
    }
    /**
     * Generate a secure random refresh handle
     */
    generateHandle() {
        return crypto_1.default.randomBytes(32).toString('base64url'); // 256-bit random handle
    }
    /**
     * Store refresh token data with TTL
     */
    async set(handle, data, ttlSeconds = 14 * 24 * 60 * 60) {
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
    async get(handle) {
        const data = this.store.get(handle);
        if (!data)
            return null;
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
    async delete(handle) {
        this.store.delete(handle);
    }
    /**
     * Rotate handle: create new one and delete old one
     */
    async rotateHandle(oldHandle, newData, ttlSeconds = 14 * 24 * 60 * 60) {
        const newHandle = this.generateHandle();
        await this.set(newHandle, newData, ttlSeconds);
        await this.delete(oldHandle);
        return newHandle;
    }
}
// Singleton instance
exports.refreshStore = new RefreshTokenStore();
/**
 * Cookie options for refresh handle
 */
exports.REFRESH_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    sameSite: 'none', // Required for cross-origin requests
    path: '/auth/refresh', // Restrict to refresh endpoint only
    maxAge: 14 * 24 * 60 * 60 * 1000, // 14 days in milliseconds
};
exports.REFRESH_COOKIE_NAME = '__Host-app_rf';
//# sourceMappingURL=refresh-store.js.map