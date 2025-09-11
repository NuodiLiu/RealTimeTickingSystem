import { prisma } from "../lib/prisma";
import { BadRequestError, ConflictError, MissingFieldError, NotFoundError } from "../error";

export class CasesService {
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

    static async postCase(data: { studentName?: string; category?: string }) {
        const { studentName, category } = data ?? {};
        if (!studentName || !category) {
            throw new MissingFieldError(["studentName", "category"]);
        }
        return prisma.studentCase.create({ data: { studentName, category } });
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

        return taken;
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
            
            if (!next) throw new NotFoundError("No queued cases");

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
                return taken;
            }

            // 4) Someone else took it → retry
            console.log(`Attempt ${attempt} failed, retrying...`);
        }

        throw new ConflictError("Case already taken by someone else");
    }

    static async resolveCase(id: string) {
        try {
            const now = new Date();
            return await prisma.studentCase.update({
                where: { id },
                data: { 
                    status: 'RESOLVED', 
                    resolvedAt: now 
                },
            });
        } catch (err: any) {
            if (err?.code === 'P2025') throw new NotFoundError('Case not found');
            throw err;
        }
    }

    static async escalateCase(id: string, department: string) {
        try {
            return await prisma.studentCase.update({
                where: { id },
                data: { escalatedTo: department },
            });
        } catch (err: any) {
            if (err?.code === 'P2025') throw new NotFoundError('Case not found');
            throw err;
        }
    }
}