"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/routers/device.router.ts
const express_1 = require("express");
const device_controller_1 = require("../controllers/device.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const jwt_auth_middleware_1 = require("../middlewares/jwt-auth.middleware");
const router = (0, express_1.Router)();
// called from（iPad/kiosk)
router.post("/heartbeat", auth_middleware_1.requireDevice, device_controller_1.DeviceController.handleHeartbeat);
router.get("/status", auth_middleware_1.requireDevice, device_controller_1.DeviceController.getDeviceStatus);
router.get("/pairing-status/:id", device_controller_1.DeviceController.checkPairingStatus);
// called from portal by staff
router.get("/", jwt_auth_middleware_1.requireJWTAuth, auth_middleware_1.requireStaff, device_controller_1.DeviceController.listDevices);
router.get("/by-mode/:mode", jwt_auth_middleware_1.requireJWTAuth, auth_middleware_1.requireStaff, device_controller_1.DeviceController.getDevicesByMode);
router.get("/online/:mode", jwt_auth_middleware_1.requireJWTAuth, auth_middleware_1.requireStaff, device_controller_1.DeviceController.getOnlineDevicesByMode);
router.post("/ws-token", auth_middleware_1.requireDevice, device_controller_1.DeviceController.issueWsToken);
router.patch("/:id/mode", jwt_auth_middleware_1.requireJWTAuth, auth_middleware_1.requireStaff, device_controller_1.DeviceController.changeMode);
router.patch("/:id/name", jwt_auth_middleware_1.requireJWTAuth, auth_middleware_1.requireStaff, device_controller_1.DeviceController.updateDeviceName);
router.delete("/:id", jwt_auth_middleware_1.requireJWTAuth, auth_middleware_1.requireStaff, device_controller_1.DeviceController.unpairDevice);
// DEV ONLY: Unpair without auth for testing
if (process.env.NODE_ENV === 'development') {
    router.delete("/dev-unpair/:id", device_controller_1.DeviceController.unpairDevice);
}
exports.default = router;
//# sourceMappingURL=device.router.js.map