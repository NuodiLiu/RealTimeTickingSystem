// src/routers/device.router.ts
import { Router } from "express";
import { DeviceController } from "../controllers/device.controller";
import { requireDevice, requireStaff } from "../middlewares/auth.middleware";
import { requireJWTAuth } from "../middlewares/jwt-auth.middleware";

const router = Router();

// called from（iPad/kiosk)
router.post("/heartbeat", requireDevice, DeviceController.handleHeartbeat);
router.get("/status", requireDevice, DeviceController.getDeviceStatus);
router.get("/pairing-status/:id", DeviceController.checkPairingStatus);

// called from portal by staff
router.get("/", requireJWTAuth, requireStaff, DeviceController.listDevices);
router.get("/by-mode/:mode", requireJWTAuth, requireStaff, DeviceController.getDevicesByMode);
router.get("/online/:mode", requireJWTAuth, requireStaff, DeviceController.getOnlineDevicesByMode);

router.post("/ws-token", requireDevice, DeviceController.issueWsToken);
router.post("/token", requireDevice, DeviceController.issueAppJWT);

router.patch("/:id/mode", requireJWTAuth, requireStaff, DeviceController.changeMode);
router.patch("/:id/name", requireJWTAuth, requireStaff, DeviceController.updateDeviceName);
router.delete("/:id", requireJWTAuth, requireStaff, DeviceController.unpairDevice);

// DEV ONLY: Unpair without auth for testing
if (process.env.NODE_ENV === 'development') {
  router.delete("/dev-unpair/:id", DeviceController.unpairDevice);
}

export default router;
