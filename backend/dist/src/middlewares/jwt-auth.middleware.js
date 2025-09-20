"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireJWTAuth = requireJWTAuth;
exports.optionalJWTAuth = optionalJWTAuth;
exports.clearStaffCache = clearStaffCache;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const error_1 = require("../error");
const staff_service_1 = require("../services/staff.service");
const auth_errors_1 = require("../lib/auth-errors");
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
        if (jwtSecret) {
            // Always verify App JWT tokens with our secret
            decoded = jsonwebtoken_1.default.verify(token, jwtSecret);
        }
        else {
            throw new Error('JWT_SECRET not configured');
        }
        if (!decoded || typeof decoded !== 'object') {
            throw new Error('Invalid token format');
        }
        // Basic validation of required claims for App JWT
        if (!decoded.sub || !decoded.typ) {
            throw new Error('Missing required claims (sub, typ)');
        }
        // Validate token type (should be 'staff' or 'device')
        if (!['staff', 'device'].includes(decoded.typ)) {
            throw new Error(`Invalid token type. Expected 'staff' or 'device', got: ${decoded.typ}`);
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
 * @deprecated Use staffService.getOrCreateStaff() instead for consistency
 */
async function getOrCreateStaff(payload) {
    // For App JWT tokens, we expect the staff to already exist
    // This is typically called for refresh scenarios
    if (!payload.identityKey) {
        throw new error_1.AuthError("identityKey is missing from JWT token", 400);
    }
    try {
        // Use the unified staff service for consistent lookup
        const staff = await staff_service_1.staffService.findStaffById(payload.sub);
        if (!staff) {
            throw new error_1.AuthError("Staff record not found", 404);
        }
        return {
            id: staff.id,
            role: staff.role,
            employeeNo: staff.employeeNo,
            identityKey: staff.identityKey,
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
        return (0, auth_errors_1.handleAuthError)(error, res);
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