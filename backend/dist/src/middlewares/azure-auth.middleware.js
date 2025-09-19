"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuthAnyTenant = exports.requireAuth = void 0;
exports.requireLogin = requireLogin;
exports.requireTenant = requireTenant;
exports.attachReqUser = attachReqUser;
const prisma_1 = require("../lib/prisma");
const error_1 = require("../error");
// verify only if logged in (session has user)
function requireLogin(req, _res, next) {
    var _a;
    const logged = (_a = req.session) === null || _a === void 0 ? void 0 : _a.user;
    if (!logged)
        throw new error_1.AuthError("Unauthorised", 401);
    next();
}
// optional enable to lock non unsw accounts
function requireTenant(req, _res, next) {
    var _a;
    const u = (_a = req.session) === null || _a === void 0 ? void 0 : _a.user;
    if (!u)
        throw new error_1.AuthError("Unauthorised", 401);
    const expected = process.env.AZURE_AD_TENANT_ID;
    if (expected && expected !== "common" && u.tid !== expected) {
        throw new error_1.AuthError("Forbidden (wrong tenant)", 403);
    }
    next();
}
// map sso sessions to staff members in system, populate req.user
// create staff upon first login
const STAFF_CACHE_TTL_MS = 5 * 60 * 1000;
async function attachReqUser(req, _res, next) {
    var _a, _b, _c;
    try {
        const su = (_a = req.session) === null || _a === void 0 ? void 0 : _a.user;
        if (!su)
            return next(new error_1.AuthError("Unauthorised", 401));
        if (process.env.NODE_ENV === 'development' && su.staffId && su.role && su.employeeNo) {
            req.user = { id: su.staffId, role: su.role, employeeNo: su.employeeNo };
            return next();
        }
        // session level cache, use directly if info exists 
        const cachedAt = su._staffCachedAt;
        if (su.staffId && su.role && su.employeeNo && cachedAt && Date.now() - cachedAt < STAFF_CACHE_TTL_MS) {
            req.user = { id: su.staffId, role: su.role, employeeNo: su.employeeNo };
            return next();
        }
        const identityKey = su.identityKey;
        if (!identityKey)
            return next(new error_1.AuthError("Unauthorised", 401));
        const upn = (_b = su.upn) !== null && _b !== void 0 ? _b : null;
        const displayName = (_c = su.name) !== null && _c !== void 0 ? _c : null;
        if (!upn) {
            throw new error_1.BadRequestError("UPN (email) is missing from Azure token");
        }
        // one time upsert based on identityKey
        const staff = await prisma_1.prisma.staff.upsert({
            where: { identityKey },
            create: {
                identityKey,
                name: displayName !== null && displayName !== void 0 ? displayName : "New User",
                email: upn,
                // use placeholder for employeeNo 
                employeeNo: `ext-${(crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`)}`,
                role: "STAFF",
                password: "", // not using local passwords
            },
            update: {
                ...(displayName ? { name: displayName } : {}),
                ...(upn ? { email: upn } : {}),
            },
            select: { id: true, role: true, employeeNo: true },
        });
        // populate req.user + session cache
        req.session.user.staffId = staff.id;
        req.session.user.role = staff.role;
        req.session.user.employeeNo = staff.employeeNo;
        req.session.user._staffCachedAt = Date.now();
        req.user = { id: staff.id, role: staff.role, employeeNo: staff.employeeNo };
        next();
    }
    catch (err) {
        next(err);
    }
}
exports.requireAuth = [
    requireLogin,
    requireTenant,
    attachReqUser,
];
exports.requireAuthAnyTenant = [
    requireLogin,
    attachReqUser,
];
//# sourceMappingURL=azure-auth.middleware.js.map