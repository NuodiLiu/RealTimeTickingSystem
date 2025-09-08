import { Router } from "express";
import { requireDevice, requireStaff } from "../middlewares/auth.middleware";
import { FeedbackController } from "../controllers/feedback.controller";
import { requireAuth } from "../middlewares/azure-auth.middleware";

const router = Router();

router.post("/send", requireAuth, requireStaff, FeedbackController.sendFeedback);
router.post("/override", requireAuth, requireStaff, FeedbackController.overrideFeedback);
router.post("/submit", requireDevice, FeedbackController.submitFeedback);

export default router;