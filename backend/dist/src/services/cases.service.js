"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CasesService = void 0;
const prisma_1 = require("../lib/prisma");
const error_1 = require("../error");
const signalr_1 = require("../signalr");
class CasesService {
    // Public method for display screens
    static async getPublicQueueData() {
        const queuedCases = await prisma_1.prisma.studentCase.findMany({
            where: { status: 'QUEUED' },
            orderBy: { createdAt: 'asc' },
            select: {
                id: true,
                studentName: true,
                createdAt: true,
                status: true,
            }
        });
        return queuedCases.map((caseItem, index) => ({
            id: caseItem.id,
            studentName: caseItem.studentName,
            position: index + 1,
            createdAt: caseItem.createdAt,
            status: caseItem.status
        }));
    }
    static async getQueuedCases(statusQuery) {
        var _a;
        const map = {
            queued: 'QUEUED',
            in_progress: 'IN_PROGRESS',
            resolved_pending_feedback: 'RESOLVED_PENDING_FEEDBACK',
            resolved: 'RESOLVED',
        };
        const status = (_a = map[String(statusQuery !== null && statusQuery !== void 0 ? statusQuery : 'queued').toLowerCase()]) !== null && _a !== void 0 ? _a : 'QUEUED';
        return prisma_1.prisma.studentCase.findMany({
            where: { status },
            orderBy: { createdAt: 'asc' },
        });
    }
    static async postCase(data) {
        const { studentName, category, zID } = data !== null && data !== void 0 ? data : {};
        if (!studentName || !category) {
            throw new error_1.MissingFieldError(["studentName", "category"]);
        }
        const created = await prisma_1.prisma.studentCase.create({
            data: {
                studentName,
                category,
                zID: zID || null
            }
        });
        // Real-time notification
        signalr_1.SignalRGateway.notifyDashboard({
            type: "case:created",
            payload: {
                id: created.id,
                studentName: created.studentName,
                category: created.category,
                zID: created.zID,
                status: created.status,
                createdAt: created.createdAt
            }
        });
        return created;
    }
    static async takeCase(id, staffId) {
        console.log('takeCase called with:', { id, staffId });
        // check if the staff exists first
        const staffExists = await prisma_1.prisma.staff.findUnique({ where: { id: staffId } });
        console.log('Staff exists?', staffExists ? 'YES' : 'NO');
        if (!staffExists) {
            throw new error_1.BadRequestError(`Staff member with ID ${staffId} not found`);
        }
        const now = new Date();
        const result = await prisma_1.prisma.studentCase.updateMany({
            where: { id, status: 'QUEUED' },
            data: {
                status: 'IN_PROGRESS',
                staffId,
                startedAt: now
            },
        });
        if (result.count === 0) {
            throw new error_1.BadRequestError("Case already taken or not in queue");
        }
        const taken = await prisma_1.prisma.studentCase.findUnique({ where: { id } });
        if (!taken)
            throw new error_1.NotFoundError("Case not found");
        console.log('Case taken successfully:', {
            id: taken.id,
            status: taken.status,
            startedAt: taken.startedAt
        });
        signalr_1.SignalRGateway.notifyDashboard({
            type: "case:updated",
            payload: {
                id: taken.id,
                status: taken.status,
                staffId: taken.staffId,
                startedAt: taken.startedAt
            }
        });
        return { case: taken, message: "Case taken successfully" };
    }
    static async takeNextCase(staffId, maxAttempts = 3) {
        const staffExists = await prisma_1.prisma.staff.findUnique({ where: { id: staffId } });
        if (!staffExists) {
            throw new error_1.BadRequestError(`Staff member with ID ${staffId} not found`);
        }
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const next = await prisma_1.prisma.studentCase.findFirst({
                where: { status: "QUEUED" },
                orderBy: [{ createdAt: "asc" }, { id: "asc" }],
                select: { id: true },
            });
            if (!next) {
                return { case: null, message: "No queued cases available" };
            }
            const now = new Date();
            const updated = await prisma_1.prisma.studentCase.updateMany({
                where: { id: next.id, status: "QUEUED" },
                data: {
                    status: "IN_PROGRESS",
                    staffId,
                    startedAt: now
                },
            });
            if (updated.count > 0) {
                // Successfully taken → return the full case
                const taken = await prisma_1.prisma.studentCase.findUnique({ where: { id: next.id } });
                console.log('Next case taken successfully:', {
                    id: taken === null || taken === void 0 ? void 0 : taken.id,
                    status: taken === null || taken === void 0 ? void 0 : taken.status,
                    startedAt: taken === null || taken === void 0 ? void 0 : taken.startedAt
                });
                if (taken) {
                    signalr_1.SignalRGateway.notifyDashboard({
                        type: "case:updated",
                        payload: {
                            id: taken.id,
                            status: taken.status,
                            staffId: taken.staffId,
                            startedAt: taken.startedAt
                        }
                    });
                }
                return { case: taken, message: "Case taken successfully" };
            }
            // 4) Someone else took it, retry
            console.log(`Attempt ${attempt} failed, retrying...`);
        }
        throw new error_1.ConflictError("Case already taken by someone else");
    }
    static async resolveCase(id) {
        try {
            const now = new Date();
            // retrieve existing case status
            const existingCase = await prisma_1.prisma.studentCase.findUnique({
                where: { id },
                select: { id: true, status: true }
            });
            if (!existingCase) {
                throw new error_1.NotFoundError('Case not found');
            }
            const wasPendingFeedback = existingCase.status === 'RESOLVED_PENDING_FEEDBACK';
            let deviceId = null;
            // If the case is in RESOLVED_PENDING_FEEDBACK, special handling is needed
            if (wasPendingFeedback) {
                // locate relevant active feedback session and device locks
                const activeFeedbackSession = await prisma_1.prisma.feedbackSession.findFirst({
                    where: {
                        caseId: id,
                        status: { in: ['CREATED', 'DELIVERED'] }
                    },
                    select: {
                        id: true,
                        deviceId: true,
                        status: true
                    }
                });
                deviceId = activeFeedbackSession === null || activeFeedbackSession === void 0 ? void 0 : activeFeedbackSession.deviceId;
                if (activeFeedbackSession) {
                    // process updates in a transaction
                    const updatedCase = await prisma_1.prisma.$transaction(async (tx) => {
                        const updatedCase = await tx.studentCase.update({
                            where: { id },
                            data: {
                                status: 'RESOLVED',
                                resolvedAt: now
                            },
                        });
                        // cancel feedback session
                        await tx.feedbackSession.updateMany({
                            where: {
                                caseId: id,
                                status: { in: ['CREATED', 'DELIVERED'] }
                            },
                            data: {
                                status: 'CANCELLED',
                                cancelledAt: now
                            }
                        });
                        // release lock
                        const activeLock = await tx.kioskLock.findFirst({
                            where: {
                                caseId: id,
                                status: 'ACTIVE'
                            }
                        });
                        if (activeLock) {
                            await tx.kioskLock.update({
                                where: { id: activeLock.id },
                                data: {
                                    status: 'COMPLETED',
                                    releasedAt: now,
                                    version: { increment: 1 }
                                }
                            });
                            // release device
                            await tx.kioskDevice.updateMany({
                                where: {
                                    currentLockId: activeLock.id
                                },
                                data: {
                                    currentLockId: null
                                }
                            });
                        }
                        return updatedCase;
                    });
                    // Real-time notifications for RESOLVED_PENDING_FEEDBACK case
                    if (deviceId) {
                        // notify iPad to close feedback interface
                        signalr_1.SignalRGateway.dismissDevice(deviceId);
                        // notify dashboard to update device status
                        signalr_1.SignalRGateway.notifyDashboard({
                            type: "device:updated",
                            payload: { id: deviceId, isBusy: false, isOnline: true }
                        });
                    }
                    // notify dashboard to update case status
                    signalr_1.SignalRGateway.notifyDashboard({
                        type: "case:updated",
                        payload: { id: id, status: "RESOLVED", resolvedAt: updatedCase.resolvedAt }
                    });
                    return updatedCase;
                }
                else {
                    // No active feedback session, directly update case
                    const updatedCase = await prisma_1.prisma.studentCase.update({
                        where: { id },
                        data: {
                            status: 'RESOLVED',
                            resolvedAt: now
                        },
                    });
                    signalr_1.SignalRGateway.notifyDashboard({
                        type: "case:updated",
                        payload: { id: id, status: "RESOLVED", resolvedAt: updatedCase.resolvedAt }
                    });
                    return updatedCase;
                }
            }
            else {
                // No active feedback session, directly update case
                const updatedCase = await prisma_1.prisma.studentCase.update({
                    where: { id },
                    data: {
                        status: 'RESOLVED',
                        resolvedAt: now
                    },
                });
                signalr_1.SignalRGateway.notifyDashboard({
                    type: "case:updated",
                    payload: { id: id, status: "RESOLVED", resolvedAt: updatedCase.resolvedAt }
                });
                return updatedCase;
            }
        }
        catch (err) {
            if ((err === null || err === void 0 ? void 0 : err.code) === 'P2025')
                throw new error_1.NotFoundError('Case not found');
            throw err;
        }
    }
    static async escalateCase(id, department, resolvedOnSite) {
        try {
            return await prisma_1.prisma.studentCase.update({
                where: { id },
                data: {
                    escalatedTo: department,
                    resolvedOnSite: resolvedOnSite
                },
            });
        }
        catch (err) {
            if ((err === null || err === void 0 ? void 0 : err.code) === 'P2025')
                throw new error_1.NotFoundError('Case not found');
            throw err;
        }
    }
}
exports.CasesService = CasesService;
//# sourceMappingURL=cases.service.js.map