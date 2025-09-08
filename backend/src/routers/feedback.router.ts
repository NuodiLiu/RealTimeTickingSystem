import { Router } from "express";
import { requireDevice, requireStaff } from "../middlewares/auth.middleware";
import { FeedbackController } from "../controllers/feedback.controller";

const router = Router();

router.post("/send", requireStaff, FeedbackController.sendFeedback);
router.post("/override", requireStaff, FeedbackController.overrideFeedback);
router.post("/submit", requireDevice, FeedbackController.submitFeedback);

export default router;