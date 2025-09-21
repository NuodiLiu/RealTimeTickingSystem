"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signDeviceToken = signDeviceToken;
exports.signStaffToken = signStaffToken;
exports.verifyStaffToken = verifyStaffToken;
exports.validateDeviceApiKey = validateDeviceApiKey;
const error_1 = require("../../error");
const crypto_1 = __importDefault(require("crypto"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = require("../prisma");
/**
 * Generate a JWT token for device authentication
 * Used for device WebSocket/SignalR connections
 */
function signDeviceToken(deviceId, mode) {
    return jsonwebtoken_1.default.sign({ sub: deviceId, mode, typ: "device" }, process.env.JWT_SECRET, { expiresIn: "30d" });
}
/**
 * Generate a short-lived JWT token for staff API access
 * Used after Azure AD authentication for API calls
 */
function signStaffToken(staffData) {
    return jsonwebtoken_1.default.sign({
        typ: 'staff',
        sub: staffData.id,
        role: staffData.role,
        employeeNo: staffData.employeeNo,
        identityKey: staffData.identityKey,
        name: staffData.name,
        email: staffData.email,
    }, process.env.JWT_SECRET, { expiresIn: '2h' } // Extended: 2 hours for development
    );
}
/**
 * Verify and decode staff JWT token
 */
function verifyStaffToken(token) {
    return jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
}
/**
 * Validate device API key from Authorization header (HTTP API)
 * Format: Authorization: Device <deviceId>:<deviceSecret>
 */
async function validateDeviceApiKey(authHeader) {
    // format: Authorization: Device <deviceId>:<deviceSecret>
    if (!(authHeader === null || authHeader === void 0 ? void 0 : authHeader.startsWith('Device '))) {
        throw new error_1.BadRequestError('Missing or invalid Authorization header');
    }
    const token = authHeader.slice('Device '.length).trim(); // "<id>:<secret>"
    const sep = token.indexOf(':');
    if (sep <= 0)
        throw new error_1.BadRequestError('Invalid device credential format');
    const deviceId = token.slice(0, sep);
    const deviceSecret = token.slice(sep + 1);
    const device = await prisma_1.prisma.kioskDevice.findUnique({ where: { id: deviceId } });
    if (!device)
        throw new error_1.NotFoundError('Device not found');
    const incoming = crypto_1.default.createHash('sha256').update(deviceSecret).digest();
    const stored = Buffer.from(device.secretHash, 'hex'); // hash format（hex/ base64）
    if (stored.length !== incoming.length) {
        throw new error_1.BadRequestError('Invalid device credentials');
    }
    if (!crypto_1.default.timingSafeEqual(stored, incoming)) {
        throw new error_1.BadRequestError('Invalid device credentials');
    }
    return { deviceId: device.id, device };
}
//# sourceMappingURL=auth.js.map