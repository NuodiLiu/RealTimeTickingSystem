"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PairService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const prisma_1 = require("../lib/prisma");
const error_1 = require("../error");
const auth_1 = require("../lib/utils/auth");
const signalr_1 = require("../signalr");
class PairService {
    // generate qr for kiosk
    static async generateQR() {
        const pairingToken = crypto_1.default.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
        const session = await prisma_1.prisma.pairingSession.create({
            data: {
                pairingToken,
                expiresAt,
                status: 'PENDING',
            },
        });
        // DEV CODE
        if (process.env.NODE_ENV === 'development') {
            await prisma_1.prisma.pairingSession.upsert({
                where: { pairingToken: 'test-token-123' },
                update: {
                    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
                    status: 'PENDING',
                },
                create: {
                    pairingToken: 'test-token-123',
                    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
                    status: 'PENDING',
                },
            });
        }
        const apiBase = process.env.API_BASE_URL || 'http://localhost:3000';
        const qrData = { pairingToken, apiEndpoint: apiBase };
        const qrUrl = `${apiBase}/pair?data=${encodeURIComponent(JSON.stringify(qrData))}`;
        return { qrUrl, pairingToken, sessionId: session.id, expiresAt };
    }
    // ipad scans qr, completes pairing
    static async completePairing(data) {
        const { pairingToken, deviceName, mode = 'REGISTRATION', deviceId } = data;
        if (!pairingToken || !deviceName) {
            throw new error_1.MissingFieldError(['pairingToken', 'deviceName']);
        }
        let session = await prisma_1.prisma.pairingSession.findUnique({
            where: { pairingToken },
        });
        // In development, allow test-token-123 to be reused
        const isTestToken = process.env.NODE_ENV === 'development' && pairingToken === 'test-token-123';
        // Auto-create test token in development if it doesn't exist
        if (!session && isTestToken) {
            session = await prisma_1.prisma.pairingSession.create({
                data: {
                    pairingToken: 'test-token-123',
                    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
                    status: 'PENDING',
                },
            });
        }
        if (!session) {
            throw new error_1.BadRequestError('Invalid or expired pairing token');
        }
        // For test token, allow reuse even if expired or completed
        if (isTestToken && (session.status === 'COMPLETED' || session.expiresAt < new Date())) {
            // Reset the test token for reuse
            await prisma_1.prisma.pairingSession.update({
                where: { id: session.id },
                data: {
                    status: 'PENDING',
                    deviceId: null,
                    completedAt: null,
                    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
                },
            });
        }
        else if (!isTestToken && (session.expiresAt < new Date() || session.status !== 'PENDING')) {
            throw new error_1.BadRequestError('Invalid or expired pairing token');
        }
        const deviceSecret = crypto_1.default.randomBytes(32).toString('hex');
        const secretHash = crypto_1.default.createHash('sha256').update(deviceSecret).digest('hex');
        let device;
        // check if re pairing of existing device
        if (deviceId) {
            const existingDevice = await prisma_1.prisma.kioskDevice.findUnique({
                where: { id: deviceId }
            });
            if (existingDevice && !existingDevice.deletedAt) {
                // update pairing info for existing devices
                device = await prisma_1.prisma.kioskDevice.update({
                    where: { id: deviceId },
                    data: {
                        name: deviceName,
                        secretHash,
                        mode: mode,
                        lastSeenAt: new Date(),
                    },
                });
            }
            else {
                throw new error_1.BadRequestError('Device not found or has been deleted');
            }
        }
        else {
            // check if device with same name exists 
            const existingDevice = await prisma_1.prisma.kioskDevice.findFirst({
                where: {
                    name: deviceName,
                    deletedAt: null
                }
            });
            if (existingDevice) {
                // re pair existing devices 
                device = await prisma_1.prisma.kioskDevice.update({
                    where: { id: existingDevice.id },
                    data: {
                        secretHash,
                        mode: mode,
                        lastSeenAt: new Date(),
                    },
                });
            }
            else {
                // create new device
                device = await prisma_1.prisma.kioskDevice.create({
                    data: {
                        name: deviceName,
                        secretHash,
                        mode: mode,
                        lastSeenAt: new Date(),
                    },
                });
            }
        }
        // Generate WebSocket token for device
        const wsToken = (0, auth_1.signDeviceToken)(device.id, mode);
        // update pairing session (but keep test token reusable in development)
        if (!isTestToken) {
            await prisma_1.prisma.pairingSession.update({
                where: { id: session.id },
                data: {
                    status: 'COMPLETED',
                    deviceId: device.id,
                    completedAt: new Date(),
                },
            });
        }
        // Real-time update: Notify dashboard about the new device pairing
        signalr_1.SignalRGateway.notifyDashboard({
            type: "device:paired",
            payload: {
                deviceId: device.id,
                deviceName: device.name,
                mode: device.mode
            }
        });
        return {
            deviceId: device.id,
            deviceSecret,
            apiKey: `${device.id}:${deviceSecret}`,
            wsToken,
            deviceName: device.name,
            mode: device.mode,
            wsEndpoint: `${process.env.WS_BASE_URL || 'ws://localhost:3000'}/ws`,
        };
    }
}
exports.PairService = PairService;
//# sourceMappingURL=pair.service.js.map