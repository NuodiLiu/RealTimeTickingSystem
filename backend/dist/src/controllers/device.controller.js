"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeviceController = void 0;
const error_1 = require("../error");
const device_service_1 = require("../services/device.service");
require("../middlewares/auth.middleware");
class DeviceController {
    static async handleHeartbeat(req, res, next) {
        var _a;
        try {
            if (!((_a = req.device) === null || _a === void 0 ? void 0 : _a.deviceId))
                throw new error_1.BadRequestError('Device authentication required');
            const result = await device_service_1.DeviceService.handleHeartbeat(req.device.deviceId);
            res.status(200).json(result);
        }
        catch (err) {
            next(err);
        }
    }
    static async getDeviceStatus(req, res, next) {
        var _a;
        try {
            if (!((_a = req.device) === null || _a === void 0 ? void 0 : _a.deviceId))
                throw new error_1.BadRequestError('Device authentication required');
            const result = await device_service_1.DeviceService.getDeviceStatus(req.device.deviceId);
            res.status(200).json(result);
        }
        catch (err) {
            next(err);
        }
    }
    static async listDevices(req, res, next) {
        var _a;
        try {
            const mode = req.query.mode;
            const statusRaw = (_a = req.query.status) === null || _a === void 0 ? void 0 : _a.toUpperCase();
            const status = (statusRaw === 'ONLINE' ||
                statusRaw === 'OFFLINE' ||
                statusRaw === 'BUSY' ||
                statusRaw === 'IDLE')
                ? statusRaw
                : undefined;
            const filters = {};
            if (mode)
                filters.mode = mode;
            if (status)
                filters.status = status;
            const devices = await device_service_1.DeviceService.listDevices(filters);
            res.status(200).json({ items: devices });
        }
        catch (err) {
            next(err);
        }
    }
    static async getDevicesByMode(req, res, next) {
        try {
            const mode = req.params.mode;
            const validModes = ['REGISTRATION', 'FEEDBACK'];
            if (!validModes.includes(mode))
                throw new error_1.BadRequestError('Invalid device mode');
            const devices = await device_service_1.DeviceService.getDevicesByMode(mode);
            res.status(200).json({ devices, mode });
        }
        catch (err) {
            next(err);
        }
    }
    static async getOnlineDevicesByMode(req, res, next) {
        try {
            const mode = req.params.mode;
            const validModes = ['REGISTRATION', 'FEEDBACK'];
            if (!validModes.includes(mode))
                throw new error_1.BadRequestError('Invalid device mode');
            const devices = await device_service_1.DeviceService.getOnlineDevicesByMode(mode);
            res.status(200).json({ devices, mode, count: devices.length });
        }
        catch (err) {
            next(err);
        }
    }
    static async issueWsToken(req, res, next) {
        var _a;
        try {
            const deviceId = (_a = req.device) === null || _a === void 0 ? void 0 : _a.deviceId;
            if (!deviceId)
                throw new error_1.BadRequestError('Device authentication required'); // ✅ 显式抛 400
            const token = await device_service_1.DeviceService.issueWsToken(deviceId);
            res.status(200).json({ deviceToken: token, expiresIn: 12 * 60 * 60 });
        }
        catch (err) {
            next(err);
        }
    }
    static async changeMode(req, res, next) {
        try {
            const { id } = req.params;
            const { mode } = req.body;
            if (!id)
                throw new error_1.BadRequestError('id required');
            if (!mode)
                throw new error_1.BadRequestError('mode required');
            const result = await device_service_1.DeviceService.changeMode(id, mode);
            res.status(200).json(result);
        }
        catch (err) {
            next(err);
        }
    }
    static async unpairDevice(req, res, next) {
        try {
            const { id } = req.params;
            if (!id)
                throw new error_1.BadRequestError('id required');
            await device_service_1.DeviceService.unpair(id);
            res.status(204).end();
        }
        catch (err) {
            next(err);
        }
    }
    static async checkPairingStatus(req, res, next) {
        try {
            const { id } = req.params;
            if (!id)
                throw new error_1.BadRequestError('Device ID required');
            const isPaired = await device_service_1.DeviceService.checkPairingStatus(id);
            res.status(200).json({ isPaired });
        }
        catch (err) {
            next(err);
        }
    }
    static async updateDeviceName(req, res, next) {
        try {
            const { id } = req.params;
            const { name } = req.body;
            if (!id)
                throw new error_1.BadRequestError('Device ID required');
            if (!name)
                throw new error_1.BadRequestError('Device name required');
            const result = await device_service_1.DeviceService.updateDeviceName(id, name);
            res.status(200).json(result);
        }
        catch (err) {
            next(err);
        }
    }
}
exports.DeviceController = DeviceController;
//# sourceMappingURL=device.controller.js.map