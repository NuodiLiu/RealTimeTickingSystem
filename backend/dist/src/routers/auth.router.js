"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/routers/auth.router.ts
const express_1 = require("express");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const error_1 = require("../error");
const prisma_1 = require("../lib/prisma");
const jwt_auth_middleware_1 = require("../middlewares/jwt-auth.middleware");
const router = (0, express_1.Router)();
// Development endpoints for testing (no actual Azure AD required)
if (process.env.NODE_ENV === 'development') {
    // Create a mock JWT token for development
    router.post('/dev-login', async (req, res) => {
        try {
            const devStaff = await prisma_1.prisma.staff.upsert({
                where: { identityKey: 'dev|user' },
                update: {},
                create: {
                    identityKey: 'dev|user',
                    employeeNo: 'DEV001',
                    name: 'Dev User',
                    email: 'dev@test.local',
                    password: '',
                    role: 'ADMIN'
                }
            });
            // Generate a mock JWT token for development
            const mockClaims = {
                iss: 'https://login.microsoftonline.com/dev-tenant/v2.0',
                sub: 'dev-user-sub',
                aud: process.env.AZURE_AD_CLIENT_ID || 'dev-client-id',
                tid: 'dev-tenant',
                oid: 'dev-object-id',
                preferred_username: 'dev@test.local',
                name: 'Dev User',
                email: 'dev@test.local',
                identityKey: 'dev|user',
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) // 24 hours
            };
            const mockAccessToken = jsonwebtoken_1.default.sign(mockClaims, process.env.JWT_SECRET, { algorithm: 'HS256' });
            res.json({
                ok: true,
                message: 'Development login successful. Use this access_token for API calls.',
                access_token: mockAccessToken,
                token_type: 'Bearer',
                expires_in: 86400,
                user: {
                    identityKey: 'dev|user',
                    staffId: devStaff.id,
                    role: 'ADMIN',
                    employeeNo: 'DEV001',
                    name: 'Dev User',
                    email: 'dev@test.local'
                }
            });
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to create dev user' });
        }
    });
    router.post('/dev-login-staff', async (req, res) => {
        try {
            const testStaff = await prisma_1.prisma.staff.upsert({
                where: { identityKey: 'dev|staff' },
                update: {},
                create: {
                    identityKey: 'dev|staff',
                    employeeNo: 'STAFF001',
                    name: 'Test Staff',
                    email: 'staff@test.local',
                    password: '',
                    role: 'STAFF'
                }
            });
            // Generate a mock JWT token for development
            const mockClaims = {
                iss: 'https://login.microsoftonline.com/dev-tenant/v2.0',
                sub: 'dev-staff-sub',
                aud: process.env.AZURE_AD_CLIENT_ID || 'dev-client-id',
                tid: 'dev-tenant',
                oid: 'dev-staff-object-id',
                preferred_username: 'staff@test.local',
                name: 'Test Staff',
                email: 'staff@test.local',
                identityKey: 'dev|staff',
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) // 24 hours
            };
            const mockAccessToken = jsonwebtoken_1.default.sign(mockClaims, process.env.JWT_SECRET, { algorithm: 'HS256' });
            res.json({
                ok: true,
                message: 'Development staff login successful. Use this access_token for API calls.',
                access_token: mockAccessToken,
                token_type: 'Bearer',
                expires_in: 86400,
                user: {
                    identityKey: 'dev|staff',
                    staffId: testStaff.id,
                    role: 'STAFF',
                    employeeNo: 'STAFF001',
                    name: 'Test Staff',
                    email: 'staff@test.local'
                }
            });
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to create staff user' });
        }
    });
}
// Test endpoints for automated testing
if (process.env.NODE_ENV === "test") {
    router.post("/__test/mock-user", (req, res) => {
        // Return success - testing should provide mocked JWT tokens
        res.json({ ok: true, message: 'Use mocked JWT tokens for testing' });
    });
    router.post("/__test/clear", (req, res) => {
        // No session to clear in JWT-based auth
        res.json({ ok: true, message: 'No session to clear - using stateless JWT auth' });
    });
}
// JWT-based authentication endpoints
// GET /auth/me - return current user info from JWT
router.get("/me", jwt_auth_middleware_1.requireJWTAuth, (req, res) => {
    res.json({ user: req.user });
});
// POST /auth/validate - validate JWT token (for frontend to check if token is still valid)
router.post("/validate", jwt_auth_middleware_1.requireJWTAuth, (req, res) => {
    res.json({
        valid: true,
        user: req.user,
        message: 'JWT token is valid'
    });
});
// GET /auth/profile - get detailed user profile
router.get("/profile", jwt_auth_middleware_1.requireJWTAuth, async (req, res, next) => {
    try {
        if (!req.user) {
            return next(new error_1.AuthError("User not authenticated", 401));
        }
        const staff = await prisma_1.prisma.staff.findUnique({
            where: { id: req.user.id },
            select: {
                id: true,
                name: true,
                email: true,
                employeeNo: true,
                role: true,
                identityKey: true,
                createdAt: true
            }
        });
        if (!staff) {
            return next(new error_1.AuthError("Staff member not found", 404));
        }
        res.json({ user: staff });
    }
    catch (error) {
        next(error);
    }
});
// Note: Login/logout is now handled by frontend MSAL library
// These informational endpoints explain the new flow
router.get("/info/login", (req, res) => {
    res.json({
        message: "Login is now handled by MSAL library in the frontend",
        flow: [
            "1. Frontend uses MSAL to authenticate with Azure AD",
            "2. Frontend obtains JWT access token with audience = your API client ID",
            "3. Frontend sends requests with 'Authorization: Bearer <token>' header",
            "4. Backend validates JWT and creates/finds user in database"
        ],
        azureConfig: {
            authority: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID || 'common'}`,
            clientId: process.env.AZURE_AD_CLIENT_ID,
            scopes: ["openid", "profile", "email"]
        }
    });
});
router.get("/info/logout", (req, res) => {
    res.json({
        message: "Logout is now handled by MSAL library in the frontend",
        flow: [
            "1. Frontend calls MSAL logout method",
            "2. MSAL redirects to Azure AD logout endpoint",
            "3. Azure AD clears the session and redirects back",
            "4. Frontend discards the JWT token"
        ],
        note: "Backend is stateless - no server-side session to clear"
    });
});
exports.default = router;
//# sourceMappingURL=auth.router.js.map