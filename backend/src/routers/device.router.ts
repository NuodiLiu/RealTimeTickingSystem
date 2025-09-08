// src/routers/device.router.ts
import { Router } from "express";
import { DeviceController } from "../controllers/device.controller";
import { requireDevice, requireStaff } from "../middlewares/auth.middleware";

const router = Router();

// called from（iPad/kiosk)
router.post("/heartbeat", requireDevice, DeviceController.handleHeartbeat);
router.get("/status", requireDevice, DeviceController.getDeviceStatus);

// called from portal by staff
router.get("/", requireStaff, DeviceController.listDevices);
router.get("/by-mode/:mode", requireStaff, DeviceController.getDevicesByMode);
router.get("/online/:mode", requireStaff, DeviceController.getOnlineDevicesByMode);

router.post("/ws-token", requireDevice, DeviceController.issueWsToken);

export default router;
