"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdmin = exports.requireStaff = void 0;
exports.requireRoleAtLeast = requireRoleAtLeast;
exports.requireDevice = requireDevice;
const error_1 = require("../error");
const auth_1 = require("../lib/utils/auth");
const ROLE_RANK = {
    STAFF: 1,
    ADMIN: 2,
};
function requireRoleAtLeast(required) {
    return (req, _res, next) => {
        const user = req.user;
        if (!user)
            return next(new error_1.AuthError("Unauthorized", 401));
        if (!(user.role in ROLE_RANK)) {
            return next(new error_1.AuthError("Invalid user role", 401));
        }
        const ok = ROLE_RANK[user.role] >= ROLE_RANK[required];
        if (!ok)
            return next(new error_1.ForbiddenRoleError());
        next();
    };
}
exports.requireStaff = requireRoleAtLeast("STAFF");
exports.requireAdmin = requireRoleAtLeast("ADMIN");
async function requireDevice(req, _res, next) {
    var _a, _b;
    try {
        const auth = (_b = (_a = req.header("Authorisation")) !== null && _a !== void 0 ? _a : req.header("authorisation")) !== null && _b !== void 0 ? _b : "";
        if (!auth)
            throw new error_1.AuthError("Missing Authorisation header", 401);
        const { deviceId, device } = await (0, auth_1.validateDeviceApiKey)(auth);
        req.device = { deviceId, device };
        next();
    }
    catch (err) {
        if (err instanceof error_1.AuthError)
            return next(err);
        return next(new error_1.AuthError("Invalid device credentials", 401));
    }
}
//# sourceMappingURL=auth.middleware.js.map