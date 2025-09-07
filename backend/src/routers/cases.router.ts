import { CasesController } from "../controllers/cases.controller";
import { Router } from "express";
import { requireDevice, requireStaff } from "../middlewares/auth.middleware";

const router = Router();

router.post("/", requireDevice, CasesController.postCase);

// Staff: list cases by status (?status=queued|in_progress|resolved)
router.get("/", requireStaff, CasesController.getQueuedCases);

// Staff: take a case by id
router.post("/:id/take", requireStaff, CasesController.takeCase);

// Staff: take next case (FIFO)
router.post("/take-next", requireStaff, CasesController.takeNextCase);

// Staff: resolve a case
router.post("/:id/resolve", requireStaff, CasesController.resolveCase);

export default router;
