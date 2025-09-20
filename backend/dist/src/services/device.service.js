"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeviceService = void 0;
const error_1 = require("../error");
const prisma_1 = require("../lib/prisma");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const signalr_1 = require("../signalr");
class DeviceService {
    // handle heartbeat, updates lastSeenAt and gets curr status
    static async handleHeartbeat(deviceId) {
        const now = new Date();
        const device = await prisma_1.prisma.kioskDevice.findUnique({
            where: { id: deviceId },
            include: {
                currentLock: {
                    include: {
                        case: true,
                        staff: { select: { name: true } },
                    },
                },
            },
        });
        if (!device || device.deletedAt)
            throw new error_1.NotFoundError('Device not found');
        await prisma_1.prisma.kioskDevice.update({
            where: { id: deviceId },
            data: { lastSeenAt: now },
        });
        let status = 'IDLE';
        if (device.currentLock && device.currentLock.status === 'ACTIVE') {
            status = 'BUSY';
        }
        return {
            success: true,
            status,
            deviceMode: device.mode,
            timestamp: now,
            currentLock: device.currentLock
                ? {
                    id: device.currentLock.id,
                    status: device.currentLock.status,
                    case: {
                        id: device.currentLock.case.id,
                        studentName: device.currentLock.case.studentName,
                        category: device.currentLock.case.category,
                        status: device.currentLock.case.status,
                    },
                    staffName: device.currentLock.staff.name,
                    leaseExpireAt: device.currentLock.leaseExpireAt,
                }
                : null,
        };
    }
    // get device status with current lock
    static async getDeviceStatus(deviceId) {
        var _a;
        const device = await prisma_1.prisma.kioskDevice.findUnique({
            where: { id: deviceId },
            include: {
                currentLock: {
                    include: {
                        case: true,
                        staff: { select: { name: true } },
                    },
                },
            },
        });
        if (!device || device.deletedAt)
            throw new error_1.NotFoundError('Device not found');
        const isOnline = await this.isDeviceOnlineDynamic(device.id, device.lastSeenAt);
        const isBusy = ((_a = device.currentLock) === null || _a === void 0 ? void 0 : _a.status) === 'ACTIVE';
        const status = isOnline ? (isBusy ? 'BUSY' : 'IDLE') : 'OFFLINE';
        return {
            deviceId: device.id,
            name: device.name,
            mode: device.mode,
            status,
            isOnline,
            lastSeenAt: device.lastSeenAt,
            currentLock: device.currentLock
                ? {
                    id: device.currentLock.id,
                    status: device.currentLock.status,
                    version: device.currentLock.version,
                    case: {
                        id: device.currentLock.case.id,
                        studentName: device.currentLock.case.studentName,
                        category: device.currentLock.case.category,
                        status: device.currentLock.case.status,
                    },
                    staffName: device.currentLock.staff.name,
                    leaseExpireAt: device.currentLock.leaseExpireAt,
                }
                : null,
        };
    }
    static isDeviceOnline(lastSeenAt, thresholdMinutes = 2) {
        const thresholdTime = Date.now() - thresholdMinutes * 60 * 1000;
        return lastSeenAt.getTime() > thresholdTime;
    }
    // services must use SignalR, no connection = offline
    static async isDeviceOnlineDynamic(deviceId, lastSeenAt, thresholdMinutes = 1) {
        // check connection to SignalR
        const signalRConnected = await this.isDeviceConnectedViaSignalR(deviceId);
        if (signalRConnected) {
            console.log(`Device ${deviceId.slice(0, 8)} is ONLINE - SignalR connected`);
            return true;
        }
        // no SignalR connection
        const minutesAgo = Math.floor((Date.now() - lastSeenAt.getTime()) / (1000 * 60));
        console.log(`Device ${deviceId.slice(0, 8)} is OFFLINE - No SignalR connection (last seen ${minutesAgo}min ago)`);
        return false;
    }
    // check if device has any active SignalR connections
    static async isDeviceConnectedViaSignalR(deviceId) {
        try {
            const isConnected = await signalr_1.SignalRGateway.isDeviceOnline(deviceId);
            if (process.env.NODE_ENV === 'development') {
                console.log(`Device ${deviceId.slice(0, 8)} SignalR: ${isConnected ? 'CONNECTED' : 'DISCONNECTED'}`);
            }
            return isConnected;
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.log(`SignalR check failed for device ${deviceId.slice(0, 8)}: ${errorMsg}`);
            return false; // SignalR服务未初始化 = 设备离线
        }
    }
    // list all devices with their current status
    static async listDevices(filters = {}) {
        const { mode, status, thresholdMinutes = 2 } = filters;
        // DB-side filter for mode
        const rows = await prisma_1.prisma.kioskDevice.findMany({
            where: { ...(mode ? { mode } : {}), deletedAt: null },
            include: {
                currentLock: {
                    include: {
                        case: true,
                        staff: { select: { name: true } },
                    },
                },
            },
            orderBy: { lastSeenAt: 'desc' },
        });
        // map to DTO + derive online/busy (simplified for serverless)
        const mapped = rows.map((row) => {
            var _a;
            // For serverless, use simpler online detection based on lastSeenAt
            const isOnline = this.isDeviceOnline(row.lastSeenAt, thresholdMinutes);
            const isBusy = ((_a = row.currentLock) === null || _a === void 0 ? void 0 : _a.status) === 'ACTIVE';
            const derivedStatus = isOnline ? (isBusy ? 'BUSY' : 'IDLE') : 'OFFLINE';
            return {
                deviceId: row.id,
                name: row.name,
                mode: row.mode,
                status: derivedStatus,
                isOnline,
                lastSeenAt: row.lastSeenAt,
                currentLock: row.currentLock
                    ? {
                        id: row.currentLock.id,
                        status: row.currentLock.status,
                        version: row.currentLock.version,
                        case: {
                            id: row.currentLock.case.id,
                            zID: row.currentLock.case.zID,
                            studentName: row.currentLock.case.studentName,
                            category: row.currentLock.case.category,
                            status: row.currentLock.case.status,
                        },
                        staffName: row.currentLock.staff.name,
                        leaseExpireAt: row.currentLock.leaseExpireAt,
                    }
                    : null,
            };
        });
        // apply remaining filters in memory
        if (!status)
            return mapped;
        if (status === 'ONLINE')
            return mapped.filter((d) => d.isOnline);
        if (status === 'OFFLINE')
            return mapped.filter((d) => !d.isOnline);
        return mapped.filter((d) => d.status === status); // BUSY or IDLE
    }
    static async getDevicesByMode(mode) {
        const rows = await prisma_1.prisma.kioskDevice.findMany({
            where: { mode, deletedAt: null },
            include: {
                currentLock: {
                    include: {
                        case: true,
                        staff: { select: { name: true } },
                    },
                },
            },
            orderBy: { lastSeenAt: 'desc' },
        });
        return rows.map((device) => {
            var _a;
            // Use simple online detection for serverless
            const isOnline = this.isDeviceOnline(device.lastSeenAt);
            const isBusy = ((_a = device.currentLock) === null || _a === void 0 ? void 0 : _a.status) === 'ACTIVE';
            const status = isOnline ? (isBusy ? 'BUSY' : 'IDLE') : 'OFFLINE';
            return {
                deviceId: device.id,
                name: device.name,
                mode: device.mode,
                status,
                isOnline,
                lastSeenAt: device.lastSeenAt,
                currentLock: device.currentLock
                    ? {
                        id: device.currentLock.id,
                        status: device.currentLock.status,
                        version: device.currentLock.version,
                        case: {
                            id: device.currentLock.case.id,
                            studentName: device.currentLock.case.studentName,
                            category: device.currentLock.case.category,
                            status: device.currentLock.case.status,
                        },
                        staffName: device.currentLock.staff.name,
                        leaseExpireAt: device.currentLock.leaseExpireAt,
                    }
                    : null,
            };
        });
    }
    static async getOnlineDevicesByMode(mode) {
        const devices = await this.getDevicesByMode(mode);
        return devices.filter((d) => d.isOnline);
    }
    static async issueWsToken(deviceId) {
        const device = await prisma_1.prisma.kioskDevice.findUnique({
            where: { id: deviceId }, select: { id: true, mode: true, deletedAt: true }
        });
        if (!device || device.deletedAt)
            throw new error_1.NotFoundError('Device not found');
        const token = jsonwebtoken_1.default.sign({ typ: 'device', sub: device.id, mode: device.mode }, process.env.JWT_SECRET, { expiresIn: '12h' });
        return token;
    }
    static async changeMode(deviceId, newMode) {
        var _a;
        const device = await prisma_1.prisma.kioskDevice.findUnique({
            where: { id: deviceId },
            include: { currentLock: true },
        });
        if (!device || device.deletedAt)
            throw new error_1.NotFoundError('Device not found');
        if (((_a = device.currentLock) === null || _a === void 0 ? void 0 : _a.status) === 'ACTIVE') {
            throw new error_1.ConflictError('Device is in an ACTIVE session; please end it before changing mode');
        }
        const updated = await prisma_1.prisma.kioskDevice.update({
            where: { id: deviceId },
            data: { mode: newMode },
            select: { id: true, name: true, mode: true, lastSeenAt: true },
        });
        // notify iPad to switch
        try {
            signalr_1.SignalRGateway.changeModeDevice(deviceId, newMode);
        }
        catch {
            // SignalR ignore error, not blocking api call
        }
        // Real-time update: Notify dashboard about the mode change
        signalr_1.SignalRGateway.notifyDashboard({
            type: "device:mode_changed",
            payload: { deviceId, mode: newMode }
        });
        return updated;
    }
    static async unpair(deviceId) {
        var _a;
        const device = await prisma_1.prisma.kioskDevice.findUnique({
            where: { id: deviceId },
            include: { currentLock: true },
        });
        if (!device || device.deletedAt)
            throw new error_1.NotFoundError('Device not found');
        if (((_a = device.currentLock) === null || _a === void 0 ? void 0 : _a.status) === 'ACTIVE') {
            throw new error_1.ConflictError('Device is in an ACTIVE session; please end it before unpairing');
        }
        await prisma_1.prisma.$transaction(async (tx) => {
            await tx.kioskDevice.update({
                where: { id: deviceId },
                data: { currentLockId: null },
            });
            // mark deleted at, invlalidate old credentials
            await tx.kioskDevice.update({
                where: { id: deviceId },
                data: {
                    deletedAt: new Date(),
                    secretHash: "", // invalidate old api key
                },
            });
        });
        // notify iPad client to unpair (if online)
        try {
            signalr_1.SignalRGateway.unpairDevice(deviceId);
        }
        catch {
            // ignore
        }
        ;
        // Real-time update: Notify dashboard about the unpair
        signalr_1.SignalRGateway.notifyDashboard({
            type: "device:unpaired",
            payload: { deviceId }
        });
    }
    static async checkPairingStatus(deviceId) {
        const device = await prisma_1.prisma.kioskDevice.findUnique({
            where: { id: deviceId },
            select: { id: true, deletedAt: true },
        });
        // Device is paired if it exists and hasn't been deleted/unpaired
        return !!(device && !device.deletedAt);
    }
    // update device name
    static async updateDeviceName(deviceId, newName) {
        if (!newName || newName.trim().length === 0) {
            throw new Error('Device name cannot be empty');
        }
        const device = await prisma_1.prisma.kioskDevice.findUnique({
            where: { id: deviceId },
        });
        if (!device || device.deletedAt) {
            throw new error_1.NotFoundError('Device not found');
        }
        const updatedDevice = await prisma_1.prisma.kioskDevice.update({
            where: { id: deviceId },
            data: { name: newName.trim() },
            select: {
                id: true,
                name: true,
                mode: true,
                lastSeenAt: true,
            },
        });
        // Notify dashboard clients about the device name change
        signalr_1.SignalRGateway.notifyDashboard({
            type: 'DEVICE_NAME_UPDATED',
            payload: {
                deviceId: updatedDevice.id,
                name: updatedDevice.name,
                mode: updatedDevice.mode,
                lastSeenAt: updatedDevice.lastSeenAt,
            },
        });
        return {
            success: true,
            device: updatedDevice,
        };
    }
}
exports.DeviceService = DeviceService;
//# sourceMappingURL=device.service.js.map