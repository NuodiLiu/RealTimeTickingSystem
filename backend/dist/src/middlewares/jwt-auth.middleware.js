"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireJWTAuth = requireJWTAuth;
exports.optionalJWTAuth = optionalJWTAuth;
exports.clearStaffCache = clearStaffCache;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const error_1 = require("../error");
const prisma_1 = require("../lib/prisma");
// Cache for staff lookups to reduce database hits
const staffCache = new Map();
const STAFF_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
/**
 * Validates and decodes JWT token from Authorization header
 */
function validateJWT(token) {
    try {
        const jwtSecret = process.env.JWT_SECRET;
        let decoded;
        if (jwtSecret && (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test')) {
            // In development/test, verify against our secret (for mock tokens)
            decoded = jsonwebtoken_1.default.verify(token, jwtSecret);
        }
        else {
            // In production, Azure AD tokens should be validated against Azure's public keys
            // For now, we'll decode without verification (assuming Azure validates on their end)
            // In production, you should validate the signature
            decoded = jsonwebtoken_1.default.decode(token);
        }
        if (!decoded || typeof decoded !== 'object') {
            throw new Error('Invalid token format');
        }
        // Basic validation of required claims
        if (!decoded.sub || !decoded.iss) {
            throw new Error('Missing required claims');
        }
        // Validate audience if specified
        const expectedAudience = process.env.AZURE_AD_CLIENT_ID;
        if (expectedAudience && decoded.aud !== expectedAudience) {
            throw new Error('Invalid audience');
        }
        return decoded;
    }
    catch (error) {
        throw new error_1.AuthError(`Invalid JWT token: ${error instanceof Error ? error.message : 'Unknown error'}`, 401);
    }
}
/**
 * Extract Bearer token from Authorization header
 */
function extractBearerToken(authHeader) {
    if (!authHeader)
        return null;
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return null;
    }
    return parts[1] || null;
}
/**
 * Get or create staff member based on JWT claims
 */
async function getOrCreateStaff(payload) {
    const identityKey = payload.identityKey;
    const upn = payload.upn || payload.preferred_username || payload.email;
    const displayName = payload.name;
    if (!identityKey) {
        throw new error_1.AuthError("identityKey is missing from JWT token", 400);
    }
    if (!upn) {
        throw new error_1.AuthError("UPN (email) is missing from JWT token", 400);
    }
    try {
        // Step 1: Try to find by identityKey first (most common case - same user returning)
        let staff = await prisma_1.prisma.staff.findUnique({
            where: { identityKey },
            select: { id: true, role: true, employeeNo: true, email: true, identityKey: true }
        });
        if (staff) {
            // Found by identityKey, update email and name if needed
            if (staff.email !== upn || (displayName && displayName !== '')) {
                await prisma_1.prisma.staff.update({
                    where: { identityKey },
                    data: {
                        ...(upn !== staff.email ? { email: upn } : {}),
                        ...(displayName ? { name: displayName } : {}),
                    }
                });
            }
            return {
                id: staff.id,
                role: staff.role,
                employeeNo: staff.employeeNo,
                identityKey: staff.identityKey
            };
        }
        // Step 2: If not found by identityKey, try to find by email (same person, different IdP)
        staff = await prisma_1.prisma.staff.findUnique({
            where: { email: upn },
            select: { id: true, role: true, employeeNo: true, identityKey: true, email: true }
        });
        if (staff) {
            // Found by email, update to new identityKey (IdP migration)
            console.log(`Migrating user from identityKey '${staff.identityKey}' to '${identityKey}' for email: ${upn}`);
            const updatedStaff = await prisma_1.prisma.staff.update({
                where: { email: upn },
                data: {
                    identityKey, // Update to new identityKey
                    ...(displayName ? { name: displayName } : {}),
                },
                select: { id: true, role: true, employeeNo: true, identityKey: true }
            });
            return {
                id: updatedStaff.id,
                role: updatedStaff.role,
                employeeNo: updatedStaff.employeeNo,
                identityKey: updatedStaff.identityKey
            };
        }
        // Step 3: Neither identityKey nor email found, create new staff
        const newStaff = await prisma_1.prisma.staff.create({
            data: {
                identityKey,
                name: displayName || "New User",
                email: upn,
                employeeNo: `ext-${crypto_1.default.randomUUID()}`,
                role: "STAFF",
                password: "", // not using local passwords
            },
            select: { id: true, role: true, employeeNo: true, identityKey: true },
        });
        console.log(`Created new staff member: ${upn} with identityKey: ${identityKey}`);
        return {
            id: newStaff.id,
            role: newStaff.role,
            employeeNo: newStaff.employeeNo,
            identityKey: newStaff.identityKey
        };
    }
    catch (error) {
        console.error('Error in getOrCreateStaff:', error);
        throw new error_1.AuthError("Failed to authenticate user", 500);
    }
}
/**
 * Middleware to require JWT authentication
 */
async function requireJWTAuth(req, res, next) {
    try {
        const authHeader = req.header('Authorization');
        console.log('Auth header:', authHeader);
        console.log('All headers:', JSON.stringify(req.headers, null, 2));
        console.log('Header keys:', Object.keys(req.headers));
        const token = extractBearerToken(authHeader);
        console.log('Extracted token:', token ? `${token.substring(0, 20)}...` : 'null');
        if (!token) {
            throw new error_1.AuthError('Missing or invalid Authorization header', 401);
        }
        const jwtPayload = validateJWT(token);
        console.log('JWT payload:', jwtPayload);
        const user = await getOrCreateStaff(jwtPayload);
        console.log('Created/found user:', user);
        req.user = user;
        next();
    }
    catch (error) {
        console.log('JWT Auth error:', error);
        if (error instanceof error_1.AuthError) {
            next(error);
        }
        else {
            next(new error_1.AuthError('Authentication failed', 401));
        }
    }
}
/**
 * Middleware to optionally authenticate with JWT (doesn't fail if no token)
 */
async function optionalJWTAuth(req, res, next) {
    try {
        const authHeader = req.header('Authorization');
        const token = extractBearerToken(authHeader);
        if (token) {
            const jwtPayload = validateJWT(token);
            const user = await getOrCreateStaff(jwtPayload);
            req.user = user;
        }
        next();
    }
    catch (error) {
        // For optional auth, we don't fail on invalid tokens
        // but we also don't set req.user
        next();
    }
}
/**
 * Clear staff cache (useful for testing)
 */
function clearStaffCache() {
    staffCache.clear();
}
//# sourceMappingURL=jwt-auth.middleware.js.map