export type SendFeedbackArgs = {
    caseId: string;
    deviceId: string;
    staffId: string;
};
export type OverrideFeedbackArgs = {
    caseId: string;
    deviceId: string;
    staffId: string;
    expectedLockId: string;
    expectedVersion: number;
};
export type SubmitFeedbackArgs = {
    sessionId: string;
    rating: number;
    comment: string;
};
export declare class FeedbackService {
    static sendFeedback({ caseId, deviceId, staffId }: SendFeedbackArgs): Promise<{
        session: {
            id: string;
            status: string;
            deviceId: string;
            caseId: string;
            expireAt: Date;
        };
        lock: {
            id: string;
            status: string;
            version: number;
            leaseExpireAt: Date;
        };
        case: {
            id: string;
            status: string;
        };
    }>;
    static overrideFeedback({ caseId, deviceId, staffId, expectedLockId, expectedVersion, }: OverrideFeedbackArgs): Promise<{
        previous: {
            lockId: string;
            status: "OVERRIDDEN";
            caseId: string;
            caseStatus: "RESOLVED";
        };
        session: {
            id: string;
            status: "CREATED";
            deviceId: string;
            caseId: string;
            expireAt: Date;
        };
        lock: {
            id: string;
            status: "ACTIVE";
            version: number;
            leaseExpireAt: Date;
        };
    }>;
    static submitFeedback({ sessionId, rating, comment }: SubmitFeedbackArgs): Promise<{
        feedback: {
            id: string;
            caseId: string;
            rating: number;
            comment: string | null;
        } | null;
        session: {
            id: string;
            status: "SUBMITTED";
        };
    }>;
}
//# sourceMappingURL=feedback.service.d.ts.map