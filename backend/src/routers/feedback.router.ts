import { Router } from "express";
import { requireDevice, requireStaff } from "../middlewares/auth.middleware";
import { FeedbackController } from "../controllers/feedback.controller";
import { requireAuth } from "../middlewares/azure-auth.middleware";

const router = Router();

// Staff: send feedback request to device
router.post("/send", requireAuth, requireStaff, FeedbackController.sendFeedback);

// Staff: override feedback status
router.post("/override", requireAuth, requireStaff, FeedbackController.overrideFeedback);

// Public: submit feedback from device  
router.post("/submit", requireDevice, FeedbackController.submitFeedback);

export default router;