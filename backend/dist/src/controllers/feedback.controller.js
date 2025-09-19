"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeedbackController = void 0;
const error_1 = require("../error");
const feedback_service_1 = require("../services/feedback.service");
class FeedbackController {
    static async sendFeedback(req, res, next) {
        var _a, _b;
        try {
            const { caseId, deviceId } = ((_a = req.body) !== null && _a !== void 0 ? _a : {});
            const staffId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.id;
            if (!staffId)
                throw new error_1.BadRequestError("Unauthorised: missing staffId");
            if (!caseId || !deviceId)
                throw new error_1.BadRequestError("caseId and deviceId are required");
            const result = await feedback_service_1.FeedbackService.sendFeedback({ caseId, deviceId, staffId });
            return res.status(200).json(result);
        }
        catch (err) {
            return next(err);
        }
    }
    static async overrideFeedback(req, res, next) {
        var _a, _b;
        try {
            const { caseId, deviceId, expectedLockId, expectedVersion } = ((_a = req.body) !== null && _a !== void 0 ? _a : {});
            const staffId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.id;
            if (!staffId)
                throw new error_1.BadRequestError("Unauthorised: missing staffId");
            if (!caseId || !deviceId || !expectedLockId || expectedVersion == null) {
                throw new error_1.BadRequestError("caseId, deviceId, expectedLockId, expectedVersion are required");
            }
            const result = await feedback_service_1.FeedbackService.overrideFeedback({
                caseId,
                deviceId,
                staffId,
                expectedLockId,
                expectedVersion: Number(expectedVersion),
            });
            res.status(200).json(result);
        }
        catch (err) {
            next(err);
        }
    }
    ;
    static async submitFeedback(req, res, next) {
        var _a, _b;
        try {
            const { sessionId, rating, comment } = ((_a = req.body) !== null && _a !== void 0 ? _a : {});
            if (!sessionId)
                throw new error_1.BadRequestError("sessionId required");
            if (rating == null)
                throw new error_1.BadRequestError("rating required");
            const normalizedComment = (_b = (typeof comment === "string" ? comment : "")) !== null && _b !== void 0 ? _b : "";
            const result = await feedback_service_1.FeedbackService.submitFeedback({
                sessionId,
                rating: Number(rating),
                comment: normalizedComment,
            });
            res.status(200).json(result);
        }
        catch (err) {
            next(err);
        }
    }
    ;
}
exports.FeedbackController = FeedbackController;
//# sourceMappingURL=feedback.controller.js.map