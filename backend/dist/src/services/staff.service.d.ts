/**
 * Staff Service - Unified staff management following industry standards
 *
 * This service consolidates all staff-related operations to ensure:
 * - Data consistency and integrity
 * - Idempotent operations
 * - Proper error handling following OAuth 2.0 standards
 * - Single source of truth for staff management
 */
import { StaffRole } from '@prisma/client';
export interface AzureAdClaims {
    iss: string;
    sub: string;
    tid: string;
    oid: string;
    upn?: string;
    preferred_username?: string;
    email?: string;
    name?: string;
}
export interface StaffInfo {
    id: string;
    role: StaffRole;
    employeeNo: string;
    name?: string;
    email?: string;
    identityKey: string;
}
export interface StaffServiceConfig {
    defaultRole: StaffRole;
    employeeNoPrefix: string;
    enableMigration: boolean;
}
/**
 * Creates a stable identity key following Azure AD best practices
 * Format: aad:{tenantId}:{objectId}
 *
 * This format ensures:
 * - Globally unique across tenants
 * - Stable across token refreshes
 * - Compatible with Azure AD B2B scenarios
 */
export declare function createStandardIdentityKey(tid: string, oid: string): string;
export declare class StaffService {
    private config;
    constructor(config?: Partial<StaffServiceConfig>);
    /**
     * Get or create staff member based on Azure AD claims
     *
     * This method follows a three-step lookup strategy:
     * 1. Find by identityKey (primary, most common case)
     * 2. Find by email (handles identity provider migration)
     * 3. Create new staff record (first-time login)
     *
     * The operation is idempotent and handles concurrent access safely.
     */
    getOrCreateStaff(claims: AzureAdClaims): Promise<StaffInfo>;
    /**
     * Find staff by identity key
     */
    private findStaffByIdentityKey;
    /**
     * Find staff by email address
     */
    private findStaffByEmail;
    /**
     * Update staff profile information
     */
    private updateStaffProfile;
    /**
     * Migrate staff identity (handles identity provider changes)
     */
    private migrateStaffIdentity;
    /**
     * Create new staff member
     */
    private createNewStaff;
    /**
     * Map database result to StaffInfo
     */
    private mapToStaffInfo;
    /**
     * Find staff by ID (for JWT validation)
     */
    findStaffById(staffId: string): Promise<StaffInfo | null>;
}
export declare const staffService: StaffService;
//# sourceMappingURL=staff.service.d.ts.map