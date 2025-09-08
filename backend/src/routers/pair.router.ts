import { Router } from "express";
import { requireStaff, requireDevice } from "../middlewares/auth.middleware";
import { PairController } from "../controllers/pair.controller";
import { requireAuth } from "../middlewares/azure-auth.middleware";

const router = Router();

router.post("/complete", PairController.completePairing);

router.post("/generate-qr", requireAuth, requireStaff, PairController.generateQR);

export default router;