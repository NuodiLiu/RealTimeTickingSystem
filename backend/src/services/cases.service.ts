import { prisma } from "../lib/prisma";
import { BadRequestError, ConflictError, MissingFieldError, NotFoundError } from "../error";
import { DeviceGateway } from "../websocket/deviceSocket";

export class CasesService {
    // Public method for display screens - returns only non-sensitive information
    static async getPublicQueueData() {
        const queuedCases = await prisma.studentCase.findMany({
            where: { status: 'QUEUED' },
            orderBy: { createdAt: 'asc' },
            select: {
                // Only select non-sensitive fields for public display
                id: true,
                studentName: true,
                createdAt: true,
                status: true,
            }
        });

        // Return sanitized data
        return queuedCases.map((caseItem, index) => ({
            id: caseItem.id,
            studentName: caseItem.studentName,
            position: index + 1, // Add position in queue
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

    static async postCase(data: { studentName?: string; category?: string; zID?: string }) {
        const { studentName, category, zID } = data ?? {};
        if (!studentName || !category || !zID) {
            throw new MissingFieldError(["studentName", "category", "zID"]);
        }
        
        const created = await prisma.studentCase.create({ data: { studentName, category, zID } });
        
        // Real-time notification: Notify dashboard that a new case was created
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
        
        // First check if the staff exists (for debugging)
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
                startedAt: now  // Set the started timestamp
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

        // Real-time notification: Notify dashboard that case status changed
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
        // Check if staff exists first
        const staffExists = await prisma.staff.findUnique({ where: { id: staffId } });
        if (!staffExists) {
            throw new BadRequestError(`Staff member with ID ${staffId} not found`);
        }
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            // 1) Find the next queued case
            const next = await prisma.studentCase.findFirst({
                where: { status: "QUEUED" },
                orderBy: [{ createdAt: "asc" }, { id: "asc" }],
                select: { id: true },
            });
            
            if (!next) {
                // Return a special response indicating no cases are available
                // instead of throwing an error
                return { case: null, message: "No queued cases available" };
            }

            const now = new Date();
            
            // 2) Try to update it
            const updated = await prisma.studentCase.updateMany({
                where: { id: next.id, status: "QUEUED" },
                data: { 
                    status: "IN_PROGRESS", 
                    staffId,
                    startedAt: now  // Set the started timestamp
                },
            });

            if (updated.count > 0) {
                // 3) Successfully taken → return the full case
                const taken = await prisma.studentCase.findUnique({ where: { id: next.id } });
                console.log('Next case taken successfully:', { 
                    id: taken?.id, 
                    status: taken?.status, 
                    startedAt: taken?.startedAt 
                });

                // Real-time notification: Notify dashboard that case status changed
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

            // 4) Someone else took it → retry
            console.log(`Attempt ${attempt} failed, retrying...`);
        }

        throw new ConflictError("Case already taken by someone else");
    }

    static async resolveCase(id: string) {
        try {
            const now = new Date();
            
            // 首先获取case的当前状态
            const existingCase = await prisma.studentCase.findUnique({
                where: { id },
                select: { id: true, status: true }
            });
            
            if (!existingCase) {
                throw new NotFoundError('Case not found');
            }
            
            const wasPendingFeedback = existingCase.status === 'RESOLVED_PENDING_FEEDBACK';
            let deviceId = null;
            
            // 如果case处于RESOLVED_PENDING_FEEDBACK状态，需要特殊处理
            if (wasPendingFeedback) {
                // 查找相关的活动反馈会话和设备锁
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
                    // 在事务中处理所有更新
                    const updatedCase = await prisma.$transaction(async (tx) => {
                        // 1. 更新case状态
                        const updatedCase = await tx.studentCase.update({
                            where: { id },
                            data: { 
                                status: 'RESOLVED', 
                                resolvedAt: now 
                            },
                        });
                        
                        // 2. 取消反馈会话
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
                        
                        // 3. 释放设备锁
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
                            
                            // 4. 释放设备
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
                        // 通知iPad关闭反馈界面  
                        DeviceGateway.publish(deviceId, {
                            type: "DISMISS"
                        });
                        
                        // 通知dashboard更新device状态
                        DeviceGateway.notifyDashboard({
                            type: "device:updated", 
                            payload: { id: deviceId, isBusy: false, isOnline: true }
                        });
                    }
                    
                    // 通知dashboard更新case状态
                    DeviceGateway.notifyDashboard({
                        type: "case:updated",
                        payload: { id: id, status: "RESOLVED", resolvedAt: updatedCase.resolvedAt }
                    });
                    
                    return updatedCase;
                } else {
                    // 没有活动反馈会话，直接更新case
                    const updatedCase = await prisma.studentCase.update({
                        where: { id },
                        data: { 
                            status: 'RESOLVED', 
                            resolvedAt: now 
                        },
                    });
                    
                    // Real-time notification: Notify dashboard that case was resolved
                    DeviceGateway.notifyDashboard({
                        type: "case:updated",
                        payload: { id: id, status: "RESOLVED", resolvedAt: updatedCase.resolvedAt }
                    });
                    
                    return updatedCase;
                }
            } else {
                // 非pending_feedback状态，正常处理
                const updatedCase = await prisma.studentCase.update({
                    where: { id },
                    data: { 
                        status: 'RESOLVED', 
                        resolvedAt: now 
                    },
                });
                
                // Real-time notification: Notify dashboard that case was resolved
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