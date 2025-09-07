import { Router } from "express";
import { requireStaff, requireDevice } from "../middlewares/auth.middleware";
import { PairController } from "../controllers/pair.controller";

const router = Router();

router.post("/complete", PairController.completePairing);

router.post("/generate-qr", requireStaff, PairController.generateQR);

router.post("/heartbeat", requireDevice, PairController.handleHeartbeat);

router.get("/status", requireDevice, PairController.getDeviceStatus);

router.get("/devices", requireStaff, PairController.listDevices);

// router.get("/devices/by-mode/:mode", requireStaff, PairController.getDevicesByMode);

// router.get("/devices/online/:mode", requireStaff, PairController.getOnlineDevicesByMode);

// router.post("/admin/cleanup", requireStaff, PairController.cleanupExpiredSessions);

export default router;