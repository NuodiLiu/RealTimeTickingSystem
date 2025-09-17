import { Router } from "express";
import { requireStaff, requireDevice } from "../middlewares/auth.middleware";
import { PairController } from "../controllers/pair.controller";
import { requireAuth } from "../middlewares/azure-auth.middleware";

const router = Router();

// complete pairing between portal and kiosk 
router.post("/complete", PairController.completePairing);

// generate QR code for pairing 
router.post("/generate-qr", requireAuth, requireStaff, PairController.generateQR);

export default router;