export declare class CasesService {
    static getPublicQueueData(): Promise<{
        id: string;
        studentName: string;
        position: number;
        createdAt: Date;
        status: import(".prisma/client").$Enums.CaseStatus;
    }[]>;
    static getQueuedCases(statusQuery?: string): Promise<{
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
    }[]>;
    static postCase(data: {
        studentName?: string;
        category?: string;
        zID?: string | null;
    }): Promise<{
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
    static takeCase(id: string, staffId: string): Promise<{
        case: {
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
        message: string;
    }>;
    static takeNextCase(staffId: string, maxAttempts?: number): Promise<{
        case: {
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
        } | null;
        message: string;
    }>;
    static resolveCase(id: string): Promise<{
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
    static escalateCase(id: string, department: string | null, resolvedOnSite: boolean | null): Promise<{
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
}
//# sourceMappingURL=cases.service.d.ts.map