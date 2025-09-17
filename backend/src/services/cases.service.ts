import { prisma } from "../lib/prisma";
import { BadRequestError, ConflictError, MissingFieldError, NotFoundError } from "../error";
import { DeviceGateway } from "../websocket/deviceSocket";

export class CasesService {
    // Public method for display screens
    static async getPublicQueueData() {
        const queuedCases = await prisma.studentCase.findMany({
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

    static async getQueuedCases(statusQuery?: string) {
        const map: Record<string, 'QUEUED' | 'IN_PROGRESS' | 'RESOLVED_PENDING_FEEDBACK' | 'RESOLVED'> = {
            queued: 'QUEUED',
            in_progress: 'IN_PROGRESS',
            resolved_pending_feedback: 'RESOLVED_PENDING_FEEDBACK',
            resolved: 'RESOLVED',
        };

        const status = map[String(statusQuery ?? 'queued').toLowerCase()] ?? 'QUEUED';
        return prisma.studentCase.findMany({
            where: { status },
            orderBy: { createdAt: 'asc' },
        });
    }

    static async postCase(data: { studentName?: string; category?: string; zID?: string | null }) {
        const { studentName, category, zID } = data ?? {};
        if (!studentName || !category) {
            throw new MissingFieldError(["studentName", "category"]);
        }
        
        const created = await prisma.studentCase.create({ 
            data: { 
                studentName, 
                category, 
                zID: zID || null 
            } 
        });
        
        // Real-time notification
        DeviceGateway.notifyDashboard({
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

    static async takeCase(id: string, staffId: string) {
        console.log('takeCase called with:', { id, staffId });
        
        // check if the staff exists first
        const staffExists = await prisma.staff.findUnique({ where: { id: staffId } });
        console.log('Staff exists?', staffExists ? 'YES' : 'NO');
        
        if (!staffExists) {
            throw new BadRequestError(`Staff member with ID ${staffId} not found`);
        }
        
        const now = new Date();
        
        const result = await prisma.studentCase.updateMany({
            where: { id, status: 'QUEUED' },
            data: { 
                status: 'IN_PROGRESS', 
                staffId,
                startedAt: now  
            },
        });
        
        if (result.count === 0) {
            throw new BadRequestError("Case already taken or not in queue");
        }

        const taken = await prisma.studentCase.findUnique({ where: { id } });
        if (!taken) throw new NotFoundError("Case not found");

        console.log('Case taken successfully:', { 
            id: taken.id, 
            status: taken.status, 
            startedAt: taken.startedAt 
        });

        DeviceGateway.notifyDashboard({
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

    static async takeNextCase(staffId: string, maxAttempts = 3) {
        const staffExists = await prisma.staff.findUnique({ where: { id: staffId } });
        if (!staffExists) {
            throw new BadRequestError(`Staff member with ID ${staffId} not found`);
        }
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const next = await prisma.studentCase.findFirst({
                where: { status: "QUEUED" },
                orderBy: [{ createdAt: "asc" }, { id: "asc" }],
                select: { id: true },
            });
            
            if (!next) {
                return { case: null, message: "No queued cases available" };
            }

            const now = new Date();
            
            const updated = await prisma.studentCase.updateMany({
                where: { id: next.id, status: "QUEUED" },
                data: { 
                    status: "IN_PROGRESS", 
                    staffId,
                    startedAt: now 
                },
            });

            if (updated.count > 0) {
                // Successfully taken → return the full case
                const taken = await prisma.studentCase.findUnique({ where: { id: next.id } });
                console.log('Next case taken successfully:', { 
                    id: taken?.id, 
                    status: taken?.status, 
                    startedAt: taken?.startedAt 
                });

                if (taken) {
                    DeviceGateway.notifyDashboard({
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

        throw new ConflictError("Case already taken by someone else");
    }

    static async resolveCase(id: string) {
        try {
            const now = new Date();
            
            // retrieve existing case status
            const existingCase = await prisma.studentCase.findUnique({
                where: { id },
                select: { id: true, status: true }
            });
            
            if (!existingCase) {
                throw new NotFoundError('Case not found');
            }
            
            const wasPendingFeedback = existingCase.status === 'RESOLVED_PENDING_FEEDBACK';
            let deviceId = null;

            // If the case is in RESOLVED_PENDING_FEEDBACK, special handling is needed
            if (wasPendingFeedback) {
                // locate relevant active feedback session and device locks
                const activeFeedbackSession = await prisma.feedbackSession.findFirst({
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
                
                deviceId = activeFeedbackSession?.deviceId;
                
                if (activeFeedbackSession) {
                    // process updates in a transaction
                    const updatedCase = await prisma.$transaction(async (tx) => {
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
                        DeviceGateway.publish(deviceId, {
                            type: "DISMISS"
                        });
                        
                        // notify dashboard to update device status
                        DeviceGateway.notifyDashboard({
                            type: "device:updated", 
                            payload: { id: deviceId, isBusy: false, isOnline: true }
                        });
                    }

                    // notify dashboard to update case status
                    DeviceGateway.notifyDashboard({
                        type: "case:updated",
                        payload: { id: id, status: "RESOLVED", resolvedAt: updatedCase.resolvedAt }
                    });
                    
                    return updatedCase;
                } else {
                    // No active feedback session, directly update case
                    const updatedCase = await prisma.studentCase.update({
                        where: { id },
                        data: { 
                            status: 'RESOLVED', 
                            resolvedAt: now 
                        },
                    });
                    
                    DeviceGateway.notifyDashboard({
                        type: "case:updated",
                        payload: { id: id, status: "RESOLVED", resolvedAt: updatedCase.resolvedAt }
                    });
                    
                    return updatedCase;
                }
            } else {
                // No active feedback session, directly update case
                const updatedCase = await prisma.studentCase.update({
                    where: { id },
                    data: { 
                        status: 'RESOLVED', 
                        resolvedAt: now 
                    },
                });
                
                DeviceGateway.notifyDashboard({
                    type: "case:updated",
                    payload: { id: id, status: "RESOLVED", resolvedAt: updatedCase.resolvedAt }
                });
                
                return updatedCase;
            }
        } catch (err: any) {
            if (err?.code === 'P2025') throw new NotFoundError('Case not found');
            throw err;
        }
    }

    static async escalateCase(id: string, department: string | null, resolvedOnSite: boolean | null) {
        try {
            return await prisma.studentCase.update({
                where: { id },
                data: { 
                    escalatedTo: department,
                    resolvedOnSite: resolvedOnSite
                },
            });
        } catch (err: any) {
            if (err?.code === 'P2025') throw new NotFoundError('Case not found');
            throw err;
        }
    }
}