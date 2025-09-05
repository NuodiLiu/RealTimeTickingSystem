import { CasesController } from '../controllers/cases.controller';
import { Router } from 'express';
import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();


router.post("/", CasesController.postCase);

// Staff: list cases by status (?status=queued|in_progress|resolved)
router.get("/", requireAuth, CasesController.getQueuedCases);

// Staff: take a case
router.post("/:id/take", requireAuth, CasesController.takeCase);

// Staff: resolve a case
router.post("/:id/resolve", requireAuth, CasesController.resolveCase);


export default router;