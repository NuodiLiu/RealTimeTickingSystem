// src/controllers/feedback.controller.ts
import { Request, Response, NextFunction } from "express";
import { BadRequestError } from "../error";
import { FeedbackService } from "../services/feedback.service";

type SendFeedbackBody = { caseId?: string; deviceId?: string };
type OverrideBody = {
  caseId?: string;
  deviceId?: string;
  expectedLockId?: string;
  expectedVersion?: number;
};
type SubmitBody = { sessionId?: string; rating?: number; comment?: string };

export class FeedbackController {
  static async sendFeedback(req: Request, res: Response, next: NextFunction) {
    try {
      const { caseId, deviceId } = (req.body ?? {}) as SendFeedbackBody;
      const staffId = req.user?.id;

      if (!staffId) throw new BadRequestError("Unauthorized: missing staffId");
      if (!caseId || !deviceId) throw new BadRequestError("caseId and deviceId are required");

      const result = await FeedbackService.sendFeedback({ caseId, deviceId, staffId });
      return res.status(200).json(result);
    } catch (err) {
      return next(err);
    }
  }

  static async overrideFeedback(req: Request, res: Response, next: NextFunction) {
    try {
      const { caseId, deviceId, expectedLockId, expectedVersion } =
        (req.body ?? {}) as OverrideBody;
      const staffId = req.user?.id;

      if (!staffId) throw new BadRequestError("Unauthorized: missing staffId");
      if (!caseId || !deviceId || !expectedLockId || expectedVersion == null) {
        throw new BadRequestError("caseId, deviceId, expectedLockId, expectedVersion are required");
      }

      const result = await FeedbackService.overrideFeedback({
        caseId,
        deviceId,
        staffId,
        expectedLockId,
        expectedVersion: Number(expectedVersion),
      });

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  static async submitFeedback(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId, rating, comment } = (req.body ?? {}) as SubmitBody;
      if (!sessionId) throw new BadRequestError("sessionId required");
      if (rating == null) throw new BadRequestError("rating required");

      const normalizedComment = (typeof comment === "string" ? comment : "") ?? "";

      const result = await FeedbackService.submitFeedback({
        sessionId,
        rating: Number(rating),
        comment: normalizedComment,
      });

      // 200 返回结果也行；如果你喜欢 204，可改为 204 并不返回 body
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };
}
