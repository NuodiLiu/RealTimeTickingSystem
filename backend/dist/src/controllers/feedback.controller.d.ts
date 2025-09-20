import { Request, Response, NextFunction } from "express";
export declare class FeedbackController {
    static sendFeedback(req: Request, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
    static overrideFeedback(req: Request, res: Response, next: NextFunction): Promise<void>;
    static submitFeedback(req: Request, res: Response, next: NextFunction): Promise<void>;
}
//# sourceMappingURL=feedback.controller.d.ts.map