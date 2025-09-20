import { CasesController } from "../controllers/cases.controller";
import { Router } from "express";
import { requireDevice, requireStaff } from "../middlewares/auth.middleware";
import { requireJWTAuth } from "../middlewares/jwt-auth.middleware";

const router = Router();

router.post("/", requireDevice, CasesController.postCase);

// Public: get queue for public display (no auth required)
router.get("/public-queue", CasesController.getPublicQueue);

// Staff: list cases by status 
router.get("/", requireJWTAuth, requireStaff, CasesController.getQueuedCases);

// Staff: take next case (FIFO)
router.post("/take-next", requireJWTAuth, requireStaff, CasesController.takeNextCase);

// Staff: take a case by id
router.post("/:id/take", requireJWTAuth, requireStaff, CasesController.takeCase);


// Staff: resolve a case
router.post("/:id/resolve", requireJWTAuth, requireStaff, CasesController.resolveCase);

// Staff: escalate a case
router.post("/:id/escalate", requireJWTAuth, requireStaff, CasesController.escalateCase);

export default router;
