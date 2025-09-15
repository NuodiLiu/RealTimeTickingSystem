// src/routers/device.router.ts
import { Router } from "express";
import { DeviceController } from "../controllers/device.controller";
import { requireDevice, requireStaff } from "../middlewares/auth.middleware";
import { requireAuth } from "../middlewares/azure-auth.middleware";

const router = Router();

// called from（iPad/kiosk)
router.post("/heartbeat", requireDevice, DeviceController.handleHeartbeat);
router.get("/status", requireDevice, DeviceController.getDeviceStatus);
router.get("/pairing-status/:id", DeviceController.checkPairingStatus);

// called from portal by staff
router.get("/", requireAuth, requireStaff, DeviceController.listDevices);
router.get("/by-mode/:mode", requireAuth, requireStaff, DeviceController.getDevicesByMode);
router.get("/online/:mode", requireAuth, requireStaff, DeviceController.getOnlineDevicesByMode);

router.post("/ws-token", requireDevice, DeviceController.issueWsToken);

router.patch("/:id/mode", requireAuth, requireStaff, DeviceController.changeMode);
router.patch("/:id/name", requireAuth, requireStaff, DeviceController.updateDeviceName);
router.delete("/:id", requireAuth, requireStaff, DeviceController.unpairDevice);

// DEV ONLY: Unpair without auth for testing
if (process.env.NODE_ENV === 'development') {
  router.delete("/dev-unpair/:id", DeviceController.unpairDevice);
}

export default router;
