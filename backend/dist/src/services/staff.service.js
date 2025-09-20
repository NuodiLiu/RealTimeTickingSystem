"use strict";
/**
 * Staff Service - Unified staff management following industry standards
 *
 * This service consolidates all staff-related operations to ensure:
 * - Data consistency and integrity
 * - Idempotent operations
 * - Proper error handling following OAuth 2.0 standards
 * - Single source of truth for staff management
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.staffService = exports.StaffService = void 0;
exports.createStandardIdentityKey = createStandardIdentityKey;
const client_1 = require("@prisma/client");
const prisma_1 = require("../lib/prisma");
const error_1 = require("../error");
const email_utils_1 = require("../lib/email-utils");
/**
 * Creates a stable identity key following Azure AD best practices
 * Format: aad:{tenantId}:{objectId}
 *
 * This format ensures:
 * - Globally unique across tenants
 * - Stable across token refreshes
 * - Compatible with Azure AD B2B scenarios
 */
function createStandardIdentityKey(tid, oid) {
    if (!tid || !oid) {
        throw new error_1.AuthError('Missing required Azure AD claims (tid, oid)', 400);
    }
    return `aad:${tid}:${oid}`;
}
/**
 * Generates a unique employee number with collision avoidance
 * Format: {prefix}-{tenantId}-{objectIdPrefix}
 */
function generateEmployeeNumber(tid, oid, prefix = 'aad') {
    if (!tid || !oid) {
        throw new error_1.AuthError('Missing required parameters for employee number generation', 400);
    }
    // Use first 8 characters of object ID for readability while maintaining uniqueness
    const oidPrefix = oid.slice(0, 8);
    return `${prefix}-${tid}-${oidPrefix}`;
}
/**
 * Default service configuration following enterprise standards
 */
const DEFAULT_CONFIG = {
    defaultRole: 'STAFF',
    employeeNoPrefix: 'aad',
    enableMigration: true,
};
class StaffService {
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
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
    async getOrCreateStaff(claims) {
        var _a;
        const identityKey = createStandardIdentityKey(claims.tid, claims.oid);
        const email = claims.upn || claims.preferred_username || claims.email;
        const normalizedEmail = email ? (0, email_utils_1.normalizeEmail)(email) : undefined;
        const displayName = claims.name;
        try {
            // Step 1: Primary lookup by identityKey
            let staff = await this.findStaffByIdentityKey(identityKey);
            if (staff) {
                // Update profile if needed
                const updates = {};
                if (normalizedEmail)
                    updates.email = normalizedEmail;
                if (displayName)
                    updates.name = displayName;
                return await this.updateStaffProfile(staff, updates);
            }
            // Step 2: Secondary lookup by email (handles IdP migration)
            if (normalizedEmail && this.config.enableMigration) {
                staff = await this.findStaffByEmail(normalizedEmail);
                if (staff) {
                    console.log(`Migrating staff identity: ${staff.identityKey} -> ${identityKey} for email: ${normalizedEmail}`);
                    return await this.migrateStaffIdentity(staff, identityKey, displayName);
                }
            }
            // Step 3: Create new staff member
            if (!normalizedEmail) {
                throw new error_1.AuthError('Email is required for new staff creation', 400);
            }
            return await this.createNewStaff({
                identityKey,
                email: normalizedEmail,
                tid: claims.tid,
                oid: claims.oid,
                ...(displayName && { name: displayName }),
            });
        }
        catch (error) {
            // Handle Prisma unique constraint violations gracefully
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError) {
                if (error.code === 'P2002') {
                    // Unique constraint violation - retry the lookup
                    console.warn('Unique constraint violation during staff creation, retrying lookup', {
                        identityKey,
                        email: normalizedEmail,
                        constraint: (_a = error.meta) === null || _a === void 0 ? void 0 : _a.target,
                    });
                    // Retry primary lookup in case of concurrent creation
                    const existingStaff = await this.findStaffByIdentityKey(identityKey);
                    if (existingStaff) {
                        return existingStaff;
                    }
                }
            }
            console.error('Error in getOrCreateStaff:', {
                error: error instanceof Error ? error.message : error,
                identityKey,
                email: normalizedEmail,
            });
            throw new error_1.AuthError('Failed to authenticate user', 500);
        }
    }
    /**
     * Find staff by identity key
     */
    async findStaffByIdentityKey(identityKey) {
        const staff = await prisma_1.prisma.staff.findUnique({
            where: { identityKey },
            select: {
                id: true,
                role: true,
                employeeNo: true,
                name: true,
                email: true,
                identityKey: true,
            },
        });
        return staff ? this.mapToStaffInfo(staff) : null;
    }
    /**
     * Find staff by email address
     */
    async findStaffByEmail(email) {
        const staff = await prisma_1.prisma.staff.findUnique({
            where: { email },
            select: {
                id: true,
                role: true,
                employeeNo: true,
                name: true,
                email: true,
                identityKey: true,
            },
        });
        return staff ? this.mapToStaffInfo(staff) : null;
    }
    /**
     * Update staff profile information
     */
    async updateStaffProfile(staff, updates) {
        const updateData = {};
        // Only update fields that have changed
        if (updates.email && updates.email !== staff.email) {
            updateData.email = updates.email;
        }
        if (updates.name && updates.name !== staff.name) {
            updateData.name = updates.name;
        }
        if (Object.keys(updateData).length === 0) {
            return staff; // No updates needed
        }
        const updatedStaff = await prisma_1.prisma.staff.update({
            where: { identityKey: staff.identityKey },
            data: updateData,
            select: {
                id: true,
                role: true,
                employeeNo: true,
                name: true,
                email: true,
                identityKey: true,
            },
        });
        return this.mapToStaffInfo(updatedStaff);
    }
    /**
     * Migrate staff identity (handles identity provider changes)
     */
    async migrateStaffIdentity(staff, newIdentityKey, displayName) {
        const updateData = {
            identityKey: newIdentityKey,
        };
        if (displayName) {
            updateData.name = displayName;
        }
        const updatedStaff = await prisma_1.prisma.staff.update({
            where: { id: staff.id },
            data: updateData,
            select: {
                id: true,
                role: true,
                employeeNo: true,
                name: true,
                email: true,
                identityKey: true,
            },
        });
        return this.mapToStaffInfo(updatedStaff);
    }
    /**
     * Create new staff member
     */
    async createNewStaff(params) {
        const employeeNo = generateEmployeeNumber(params.tid, params.oid, this.config.employeeNoPrefix);
        const staff = await prisma_1.prisma.staff.create({
            data: {
                identityKey: params.identityKey,
                email: params.email,
                name: params.name || 'New User',
                employeeNo,
                role: this.config.defaultRole,
                password: '', // Not used for Azure AD accounts
            },
            select: {
                id: true,
                role: true,
                employeeNo: true,
                name: true,
                email: true,
                identityKey: true,
            },
        });
        console.log(`Created new staff member: ${params.email} with identityKey: ${params.identityKey}`);
        return this.mapToStaffInfo(staff);
    }
    /**
     * Map database result to StaffInfo
     */
    mapToStaffInfo(staff) {
        return {
            id: staff.id,
            role: staff.role,
            employeeNo: staff.employeeNo,
            identityKey: staff.identityKey,
            ...(staff.name && { name: staff.name }),
            ...(staff.email && { email: staff.email }),
        };
    }
    /**
     * Find staff by ID (for JWT validation)
     */
    async findStaffById(staffId) {
        const staff = await prisma_1.prisma.staff.findUnique({
            where: { id: staffId },
            select: {
                id: true,
                role: true,
                employeeNo: true,
                name: true,
                email: true,
                identityKey: true,
            },
        });
        return staff ? this.mapToStaffInfo(staff) : null;
    }
}
exports.StaffService = StaffService;
// Export default instance for convenience
exports.staffService = new StaffService();
//# sourceMappingURL=staff.service.js.map