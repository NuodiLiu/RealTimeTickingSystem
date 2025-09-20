import { prisma } from "../../lib/prisma";
import type { Prisma } from "@prisma/client";
export type DB = Prisma.TransactionClient | typeof prisma;
export declare function loadBasics(db: DB, args: {
    caseId: string;
    deviceId: string;
    staffId: string;
}): Promise<{
    scase: {
        id: string;
        createdAt: Date;
        staffId: string | null;
        status: import(".prisma/client").$Enums.CaseStatus;
        zID: string | null;
        studentName: string;
        category: string;
        escalatedTo: string | null;
        resolvedOnSite: boolean | null;
        resolvedAt: Date | null;
        startedAt: Date | null;
    };
    device: {
        id: string;
        name: string;
        currentLockId: string | null;
        secretHash: string;
        mode: import(".prisma/client").$Enums.DeviceMode;
        lastSeenAt: Date;
        deletedAt: Date | null;
    };
    staff: {
        id: string;
        name: string | null;
    };
}>;
export declare function assertModeAllowsFeedback(mode: string): void;
export declare function assertOnline(lastSeenAt: Date): void;
export declare function findActiveLock(db: DB, deviceId: string): Promise<({
    staff: {
        id: string;
        name: string | null;
    };
    case: {
        id: string;
        studentName: string;
    };
} & {
    id: string;
    createdAt: Date;
    caseId: string;
    staffId: string;
    deviceId: string;
    status: import(".prisma/client").$Enums.LockStatus;
    version: number;
    leaseExpireAt: Date;
    releasedAt: Date | null;
}) | null>;
export declare function throwBusy(lock: {
    id: string;
    version: number;
    caseId: string;
    staff: {
        name: string | null;
    };
    case: {
        studentName: string;
    };
}): void;
export declare function computeTimes(now?: Date): {
    now: Date;
    leaseExpireAt: Date;
    sessionExpireAt: Date;
};
export declare function createSessionTx(db: DB, args: {
    caseId: string;
    staffId: string;
    deviceId: string;
    expireAt: Date;
}): Prisma.Prisma__FeedbackSessionClient<{
    id: string;
    createdAt: Date;
    caseId: string;
    staffId: string;
    deviceId: string;
    status: import(".prisma/client").$Enums.FeedbackSessionStatus;
    deliveredAt: Date | null;
    submittedAt: Date | null;
    overriddenAt: Date | null;
    cancelledAt: Date | null;
    expireAt: Date | null;
}, never, import("@prisma/client/runtime/library").DefaultArgs, Prisma.PrismaClientOptions>;
export declare function createLockTx(db: DB, args: {
    deviceId: string;
    staffId: string;
    caseId: string;
    leaseExpireAt: Date;
}): Prisma.Prisma__KioskLockClient<{
    id: string;
    createdAt: Date;
    caseId: string;
    staffId: string;
    deviceId: string;
    status: import(".prisma/client").$Enums.LockStatus;
    version: number;
    leaseExpireAt: Date;
    releasedAt: Date | null;
}, never, import("@prisma/client/runtime/library").DefaultArgs, Prisma.PrismaClientOptions>;
export declare function casBindCurrentLock(db: DB, deviceId: string, lockId: string, codeWhenFail?: "busy" | "precondition_failed"): Promise<void>;
export declare function markCasePendingIfNeeded(db: DB, caseId: string, currentStatus: string): Promise<void>;
export declare function preconditionFailed(current: {
    id: string;
    version: number;
    caseId: string;
    staff: {
        name: string | null;
    };
    case: {
        studentName: string;
    };
}): void;
export declare function clearDevicePointerToLock(db: DB, deviceId: string, expectedLockId: string): Promise<void>;
export declare function overrideOldLockTx(db: DB, lockId: string, expectedVersion: number, now?: Date): Promise<void>;
export declare function overrideActiveSessionsOnDevice(db: DB, deviceId: string, staffId: string, now?: Date): Prisma.PrismaPromise<Prisma.BatchPayload>;
export declare function resolveOriginalCase(db: DB, caseId: string, now?: Date): Promise<{
    id: string;
    createdAt: Date;
    staffId: string | null;
    status: import(".prisma/client").$Enums.CaseStatus;
    zID: string | null;
    studentName: string;
    category: string;
    escalatedTo: string | null;
    resolvedOnSite: boolean | null;
    resolvedAt: Date | null;
    startedAt: Date | null;
}>;
//# sourceMappingURL=feedback.utils.d.ts.map