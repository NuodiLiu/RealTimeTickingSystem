import { CasesController } from "../controllers/cases.controller";
import { Router } from "express";
import { requireDevice, requireStaff } from "../middlewares/auth.middleware";
import { requireAuth } from "../middlewares/azure-auth.middleware";

const router = Router();

// ✅ DEV-ONLY seeding route (no auth) — enable with env flag
if (process.env.ALLOW_UNAUTH_CASE_SEED === "1") {
    router.post("/dev-seed", CasesController.postCase);
  }

  //DEV ONLY: allow listing without staff auth
  if (process.env.ALLOW_UNAUTH_CASE_READ === "1") {
    router.get("/", CasesController.getQueuedCases);
  } else {
    router.get("/", requireStaff, CasesController.getQueuedCases);
  }

router.post("/", requireDevice, CasesController.postCase);

// Staff: list cases by status (?status=queued|in_progress|resolved)
router.get("/", requireAuth, requireStaff, CasesController.getQueuedCases);

// Staff: take a case by id
router.post("/:id/take", requireAuth, requireStaff, CasesController.takeCase);

// Staff: take next case (FIFO)
router.post("/take-next", requireAuth, requireStaff, CasesController.takeNextCase);

// Staff: resolve a case
router.post("/:id/resolve", requireAuth, requireStaff, CasesController.resolveCase);

export default router;
