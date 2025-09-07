import { Router } from "express";
import { requireStaff, requireDevice } from "../middlewares/auth.middleware";
import { PairController } from "../controllers/pair.controller";

const router = Router();

router.post("/complete", PairController.completePairing);

router.post("/generate-qr", requireStaff, PairController.generateQR);

export default router;