/**
 * Refresh token storage structure
 */
export interface RefreshTokenData {
    msalAccount: any;
    providerRefresh: string;
    staffId: string;
    tokenVersion: number;
    exp: number;
    identityKey: string;
    expiresAt?: number;
}
/**
 * In-memory store for refresh tokens (for development)
 * In production, replace with Redis/Azure Cache for Redis
 */
declare class RefreshTokenStore {
    private store;
    /**
     * Generate a secure random refresh handle
     */
    generateHandle(): string;
    /**
     * Store refresh token data with TTL
     */
    set(handle: string, data: RefreshTokenData, ttlSeconds?: number): Promise<void>;
    /**
     * Get refresh token data by handle
     */
    get(handle: string): Promise<RefreshTokenData | null>;
    /**
     * Delete refresh token data (handle rotation)
     */
    delete(handle: string): Promise<void>;
    /**
     * Rotate handle: create new one and delete old one
     */
    rotateHandle(oldHandle: string, newData: RefreshTokenData, ttlSeconds?: number): Promise<string>;
}
export declare const refreshStore: RefreshTokenStore;
/**
 * Cookie options for refresh handle
 */
export declare const REFRESH_COOKIE_OPTIONS: {
    readonly httpOnly: true;
    readonly secure: boolean;
    readonly sameSite: "none";
    readonly path: "/auth/refresh";
    readonly maxAge: number;
};
export declare const REFRESH_COOKIE_NAME = "__Host-app_rf";
export {};
//# sourceMappingURL=refresh-store.d.ts.map