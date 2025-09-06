import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import { FeedbackController } from "../controllers/feedback.controller";

const router = Router();

router.post("/send", requireAuth, FeedbackController.sendFeedback);
router.post("/override", requireAuth, FeedbackController.overrideFeedback);
router.post("/submit", FeedbackController.submitFeedback); // needs to add JWT auth from device

export default router;