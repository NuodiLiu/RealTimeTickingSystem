"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyDeviceHandshake = verifyDeviceHandshake;
exports.verifySocketHandshake = verifySocketHandshake;
exports.signDeviceToken = signDeviceToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = require("../lib/prisma");
async function verifyDeviceHandshake(socket) {
    var _a, _b, _c;
    const bearer = String(socket.handshake.headers.authorization || "");
    const fromHeader = bearer.replace(/^Bearer\s+/i, "");
    const fromAuth = (_b = (_a = socket.handshake.auth) === null || _a === void 0 ? void 0 : _a.deviceToken) !== null && _b !== void 0 ? _b : (_c = socket.handshake.auth) === null || _c === void 0 ? void 0 : _c.token;
    const token = fromAuth || fromHeader;
    if (!token)
        throw new Error("Missing device token");
    let payload;
    try {
        payload = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
    }
    catch {
        throw new Error("Invalid device token");
    }
    if (!(payload === null || payload === void 0 ? void 0 : payload.sub) || payload.typ !== 'device') {
        throw new Error("Invalid device token payload");
    }
    const device = await prisma_1.prisma.kioskDevice.findUnique({
        where: { id: payload.sub },
        select: { id: true, mode: true },
    });
    if (!device)
        throw new Error("Device not found");
    return { deviceId: device.id, mode: device.mode };
}
// handle both device and dashboard connections
async function verifySocketHandshake(socket) {
    var _a, _b, _c;
    const bearer = String(socket.handshake.headers.authorization || "");
    const fromHeader = bearer.replace(/^Bearer\s+/i, "");
    const fromAuth = (_b = (_a = socket.handshake.auth) === null || _a === void 0 ? void 0 : _a.deviceToken) !== null && _b !== void 0 ? _b : (_c = socket.handshake.auth) === null || _c === void 0 ? void 0 : _c.token;
    const token = fromAuth || fromHeader;
    if (!token) {
        return { type: 'dashboard' };
    }
    let payload;
    try {
        payload = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
    }
    catch {
        return { type: 'dashboard' };
    }
    if (payload.typ === 'device') {
        const devicePayload = payload;
        if (!devicePayload.sub) {
            throw new Error("Invalid device token payload");
        }
        const device = await prisma_1.prisma.kioskDevice.findUnique({
            where: { id: devicePayload.sub },
            select: { id: true, mode: true },
        });
        if (!device)
            throw new Error("Device not found");
        return {
            type: 'device',
            deviceId: device.id,
            mode: device.mode
        };
    }
    else {
        return { type: 'dashboard', userId: payload.sub };
    }
}
function signDeviceToken(deviceId, mode) {
    return jsonwebtoken_1.default.sign({ sub: deviceId, mode, typ: "device" }, process.env.JWT_SECRET, { expiresIn: "30d" });
}
//# sourceMappingURL=auth.js.map