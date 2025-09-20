import { Router } from "express";
import { requireDevice, requireStaff } from "../middlewares/auth.middleware";
import { FeedbackController } from "../controllers/feedback.controller";
import { requireJWTAuth } from "../middlewares/jwt-auth.middleware";

const router = Router();

// Staff: send feedback request to device
router.post("/send", requireJWTAuth, requireStaff, FeedbackController.sendFeedback);

// Staff: override feedback status
router.post("/override", requireJWTAuth, requireStaff, FeedbackController.overrideFeedback);

// Public: submit feedback from device  
router.post("/submit", requireDevice, FeedbackController.submitFeedback);

export default router;