"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeedbackService = void 0;
const prisma_1 = require("../lib/prisma");
const error_1 = require("../error");
const feedback_utils_1 = require("./utils/feedback.utils");
const signalr_1 = require("../signalr");
class FeedbackService {
    static async sendFeedback({ caseId, deviceId, staffId }) {
        if (!caseId || !deviceId || !staffId) {
            throw new error_1.BadRequestError("caseId, deviceId, staffId are required");
        }
        // read and validate
        const { scase, device, staff } = await (0, feedback_utils_1.loadBasics)(prisma_1.prisma, { caseId, deviceId, staffId });
        (0, feedback_utils_1.assertModeAllowsFeedback)(device.mode);
        (0, feedback_utils_1.assertOnline)(device.lastSeenAt);
        // Busy/Idle Check
        const activeLock = await (0, feedback_utils_1.findActiveLock)(prisma_1.prisma, deviceId);
        if (activeLock)
            (0, feedback_utils_1.throwBusy)(activeLock);
        // check if other devices are processing this case
        const existingActiveFeedback = await prisma_1.prisma.feedbackSession.findFirst({
            where: {
                caseId,
                status: { in: ['CREATED', 'DELIVERED'] },
                deviceId: { not: deviceId }
            },
            select: {
                id: true,
                deviceId: true,
                device: {
                    select: { name: true }
                }
            }
        });
        if (existingActiveFeedback) {
            const err = new error_1.ConflictError(`This case already has an active feedback session on device "${existingActiveFeedback.device.name}"`);
            err.code = "feedback_in_progress";
            throw err;
        }
        // create session + lock + binding + pending feedback
        const { now, leaseExpireAt, sessionExpireAt } = (0, feedback_utils_1.computeTimes)();
        const { session, lock } = await prisma_1.prisma.$transaction(async (tx) => {
            const d = await tx.kioskDevice.findUnique({ where: { id: deviceId }, select: { id: true, mode: true } });
            if (!d)
                throw new error_1.NotFoundError("Device not found");
            (0, feedback_utils_1.assertModeAllowsFeedback)(d.mode);
            const session = await (0, feedback_utils_1.createSessionTx)(tx, { caseId, staffId, deviceId, expireAt: sessionExpireAt });
            const lock = await (0, feedback_utils_1.createLockTx)(tx, { deviceId, staffId, caseId, leaseExpireAt });
            await (0, feedback_utils_1.casBindCurrentLock)(tx, deviceId, lock.id, "busy");
            await (0, feedback_utils_1.markCasePendingIfNeeded)(tx, caseId, scase.status);
            return { session, lock };
        });
        // push to device
        signalr_1.SignalRGateway.showFeedback(deviceId, {
            sessionId: session.id,
            caseId,
            staff: { id: staff.id, name: staff.name },
            expireAt: sessionExpireAt.toISOString(),
        });
        // notify dashboard device is now busy
        signalr_1.SignalRGateway.notifyDashboard({
            type: "device:updated",
            payload: { id: deviceId, isBusy: true, isOnline: true }
        });
        return {
            session: { id: session.id, status: "CREATED", deviceId, caseId, expireAt: sessionExpireAt },
            lock: { id: lock.id, status: "ACTIVE", version: lock.version, leaseExpireAt },
            case: { id: scase.id, status: scase.status === "RESOLVED" ? "RESOLVED" : "RESOLVED_PENDING_FEEDBACK" },
        };
    }
    static async overrideFeedback({ caseId, deviceId, staffId, expectedLockId, expectedVersion, }) {
        if (!caseId || !deviceId || !staffId || !expectedLockId || expectedVersion == null) {
            throw new error_1.BadRequestError("caseId, deviceId, staffId, expectedLockId, expectedVersion are required");
        }
        const { scase, device, staff } = await (0, feedback_utils_1.loadBasics)(prisma_1.prisma, { caseId, deviceId, staffId });
        (0, feedback_utils_1.assertModeAllowsFeedback)(device.mode);
        (0, feedback_utils_1.assertOnline)(device.lastSeenAt);
        const currentLock = await (0, feedback_utils_1.findActiveLock)(prisma_1.prisma, deviceId);
        if (!currentLock) {
            const err = new error_1.ConflictError("Device is not busy");
            err.code = "idle";
            throw err;
        }
        if (currentLock.id !== expectedLockId || currentLock.version !== expectedVersion) {
            (0, feedback_utils_1.preconditionFailed)(currentLock);
        }
        // override old lock and session, create new lock + session, bind, pending feedback
        const { now, leaseExpireAt, sessionExpireAt } = (0, feedback_utils_1.computeTimes)();
        const { newSession, newLock } = await prisma_1.prisma.$transaction(async (tx) => {
            const d = await tx.kioskDevice.findUnique({ where: { id: deviceId }, select: { id: true, mode: true } });
            if (!d)
                throw new error_1.NotFoundError("Device not found");
            (0, feedback_utils_1.assertModeAllowsFeedback)(d.mode);
            await (0, feedback_utils_1.clearDevicePointerToLock)(tx, deviceId, expectedLockId);
            await (0, feedback_utils_1.overrideOldLockTx)(tx, expectedLockId, expectedVersion, now);
            await (0, feedback_utils_1.overrideActiveSessionsOnDevice)(tx, deviceId, staffId, now);
            // Resolve原始case（被override的case直接resolve，无需feedback）
            await (0, feedback_utils_1.resolveOriginalCase)(tx, currentLock.caseId, now);
            const newSession = await (0, feedback_utils_1.createSessionTx)(tx, { caseId, staffId, deviceId, expireAt: sessionExpireAt });
            const newLock = await (0, feedback_utils_1.createLockTx)(tx, { deviceId, staffId, caseId, leaseExpireAt });
            await (0, feedback_utils_1.casBindCurrentLock)(tx, deviceId, newLock.id, "precondition_failed");
            await (0, feedback_utils_1.markCasePendingIfNeeded)(tx, caseId, scase.status);
            return { newSession, newLock };
        });
        // replace feedback request on device
        signalr_1.SignalRGateway.dismissDevice(deviceId);
        // show feedback 
        signalr_1.SignalRGateway.showFeedback(deviceId, {
            sessionId: newSession.id,
            caseId,
            staff: { id: staff.id, name: staff.name },
            expireAt: sessionExpireAt.toISOString(),
        });
        // device is busy with new case
        signalr_1.SignalRGateway.notifyDashboard({
            type: "device:updated",
            payload: {
                id: deviceId,
                isBusy: true,
                isOnline: true,
                currentCaseId: caseId,
                overriddenCaseId: currentLock.caseId
            }
        });
        return {
            previous: {
                lockId: expectedLockId,
                status: "OVERRIDDEN",
                caseId: currentLock.caseId,
                caseStatus: "RESOLVED"
            },
            session: { id: newSession.id, status: "CREATED", deviceId, caseId, expireAt: sessionExpireAt },
            lock: { id: newLock.id, status: "ACTIVE", version: newLock.version, leaseExpireAt },
        };
    }
    static async submitFeedback({ sessionId, rating, comment }) {
        if (!sessionId || rating == null) {
            throw new error_1.BadRequestError("sessionId and rating are required");
        }
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            throw new error_1.BadRequestError("rating must be an integer in [1..5]");
        }
        const session = await prisma_1.prisma.feedbackSession.findUnique({
            where: { id: sessionId },
            select: {
                id: true, status: true, caseId: true, deviceId: true, staffId: true,
            },
        });
        if (!session)
            throw new error_1.NotFoundError("Feedback session not found");
        // session must be active
        if (session.status === "OVERRIDDEN" || session.status === "CANCELLED" || session.status === "EXPIRED") {
            const err = new error_1.ConflictError("Session inactive");
            err.code = "session_inactive";
            throw err;
        }
        if (session.status === "SUBMITTED") {
            const existing = await prisma_1.prisma.feedback.findUnique({ where: { caseId: session.caseId } });
            return {
                feedback: existing ? { id: existing.id, caseId: existing.caseId, rating: existing.rating, comment: existing.comment } : null,
                session: { id: session.id, status: "SUBMITTED" },
            };
        }
        const now = new Date();
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            let feedbackId = null;
            try {
                const created = await tx.feedback.create({
                    data: {
                        caseId: session.caseId,
                        staffId: session.staffId,
                        rating,
                        comment,
                    },
                    select: { id: true },
                });
                feedbackId = created.id;
            }
            catch (e) {
                if ((e === null || e === void 0 ? void 0 : e.code) !== "P2002")
                    throw e;
            }
            // sesssion submitted
            await tx.feedbackSession.update({
                where: { id: session.id },
                data: { status: "SUBMITTED", submittedAt: now },
            });
            // lock completed
            const activeLock = await tx.kioskLock.findFirst({
                where: { deviceId: session.deviceId, caseId: session.caseId, status: "ACTIVE" },
                select: { id: true },
            });
            if (activeLock) {
                await tx.kioskLock.updateMany({
                    where: { id: activeLock.id, status: "ACTIVE" },
                    data: { status: "COMPLETED", releasedAt: now, version: { increment: 1 } },
                });
                await tx.kioskDevice.updateMany({
                    where: { id: session.deviceId, currentLockId: activeLock.id },
                    data: { currentLockId: null },
                });
            }
            // case resolved
            await tx.studentCase.update({
                where: { id: session.caseId },
                data: { status: "RESOLVED", resolvedAt: now },
            });
            return { feedbackId };
        });
        // notify device, if submission successful, go back to idle
        signalr_1.SignalRGateway.dismissDevice(session.deviceId);
        // device idle again after notifying dashboard
        signalr_1.SignalRGateway.notifyDashboard({
            type: "case:updated",
            payload: { id: session.caseId, status: "RESOLVED" }
        });
        signalr_1.SignalRGateway.notifyDashboard({
            type: "device:updated",
            payload: { id: session.deviceId, isBusy: false, isOnline: true }
        });
        return {
            feedback: result.feedbackId ? { id: result.feedbackId, caseId: session.caseId, rating, comment } : null,
            session: { id: session.id, status: "SUBMITTED" },
        };
    }
}
exports.FeedbackService = FeedbackService;
//# sourceMappingURL=feedback.service.js.map