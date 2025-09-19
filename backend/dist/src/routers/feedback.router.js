"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const feedback_controller_1 = require("../controllers/feedback.controller");
const jwt_auth_middleware_1 = require("../middlewares/jwt-auth.middleware");
const router = (0, express_1.Router)();
// Staff: send feedback request to device
router.post("/send", jwt_auth_middleware_1.requireJWTAuth, auth_middleware_1.requireStaff, feedback_controller_1.FeedbackController.sendFeedback);
// Staff: override feedback status
router.post("/override", jwt_auth_middleware_1.requireJWTAuth, auth_middleware_1.requireStaff, feedback_controller_1.FeedbackController.overrideFeedback);
// Public: submit feedback from device  
router.post("/submit", auth_middleware_1.requireDevice, feedback_controller_1.FeedbackController.submitFeedback);
exports.default = router;
//# sourceMappingURL=feedback.router.js.map