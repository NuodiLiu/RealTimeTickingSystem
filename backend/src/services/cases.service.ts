
import { prisma } from "../lib/prisma";
import { BadRequestError, ConflictError, MissingFieldError, NotFoundError } from "../error";

export class CasesService {
    static async getQueuedCases(statusQuery?: string) {
        const map: Record<string, 'QUEUED' | 'IN_PROGRESS' | 'RESOLVED'> = {
            queued: 'QUEUED',
            in_progress: 'IN_PROGRESS',
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
        const result = await prisma.studentCase.updateMany({
            where: { id, status: 'QUEUED' },
            data: { status: 'IN_PROGRESS', staffId },
        });
        if (result.count === 0) throw new BadRequestError("Case already taken or not in queue");

        const taken = await prisma.studentCase.findUnique({ where: { id } });
        if (!taken) throw new NotFoundError("Case not found");

        return taken;
    }

    static async takeNextCase(staffId: string, maxAttempts = 3) {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            // 1) 找到队头
            const next = await prisma.studentCase.findFirst({
                where: { status: "QUEUED" },
                orderBy: [{ createdAt: "asc" }, { id: "asc" }],
                select: { id: true },
            });
            if (!next) throw new NotFoundError("No queued cases");

            // 2) 尝试更新
            const updated = await prisma.studentCase.updateMany({
                where: { id: next.id, status: "QUEUED" },
                data: { status: "IN_PROGRESS", staffId },
            });

            if (updated.count > 0) {
                // 3) 成功拿到 → 返回
                return prisma.studentCase.findUnique({ where: { id: next.id } });
            }

            // 4) 被别人抢走 → 重试下一条
        }

        // 重试 maxAttempts 次都失败，说明一直冲突
        throw new ConflictError("Case already taken by someone else");
    }

    static async resolveCase(id: string) {
        try {
            return await prisma.studentCase.update({
                where: { id },
                data: { status: 'RESOLVED', resolvedAt: new Date() },
            });
        } catch (err: any) {
            if (err?.code === 'P2025') throw new NotFoundError('Case not found');
            throw err;
        }
    }
}
