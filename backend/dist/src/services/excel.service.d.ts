import * as XLSX from 'xlsx';
export interface CaseExportData {
    zID: string | null;
    studentName: string;
    category: string;
    status: string;
    createdAt: Date;
    startedAt: Date | null;
    resolvedAt: Date | null;
    staffId: string | null;
    staffName: string | null;
    staffEmail: string | null;
    staffRole: string | null;
    escalatedTo: string | null;
    feedbackRating: number | null;
    feedbackComment: string | null;
    feedbackCreatedAt: Date | null;
    waitingTimeSeconds: number | null;
    processingTimeSeconds: number | null;
    totalTimeSeconds: number | null;
    waitingTimeFormatted: string | null;
    processingTimeFormatted: string | null;
    totalTimeFormatted: string | null;
    hasEscalation: boolean;
    hasFeedback: boolean;
    isComplete: boolean;
}
export declare class ExcelService {
    static formatDuration(seconds: number): string;
    static calculateTimeDifference(startTime: Date, endTime: Date): number;
    static getCasesForExport(filters?: {
        status?: string[];
        startDate?: Date;
        endDate?: Date;
        staffId?: string;
        category?: string;
        hasFeedback?: boolean;
    }): Promise<CaseExportData[]>;
    static generateExcelWorkbook(data: CaseExportData[]): Promise<XLSX.WorkBook>;
    static generateSummaryStats(data: CaseExportData[]): ({
        Metric: string;
        Value: number;
    } | {
        Metric: string;
        Value: string;
    })[];
    static generateCategoryStats(data: CaseExportData[]): {
        Category: string;
        'Total Cases': number;
        'Resolved Cases': number;
        'Resolution Rate': string;
        'Cases with Feedback': number;
        'Escalated Cases': number;
        'Escalation Rate': string;
        'Avg Waiting Time': string;
        'Avg Processing Time': string;
        'Avg Rating': string;
    }[];
    static generateStaffStats(data: CaseExportData[]): {
        Staff: string;
        'Total Cases': number;
        'Resolved Cases': number;
        'Resolution Rate': string;
        'Cases with Feedback': number;
        'Escalated Cases': number;
        'Avg Waiting Time': string;
        'Avg Processing Time': string;
        'Avg Rating': string;
    }[];
    static calculateAverage(numbers: number[]): number | null;
    static generateTimeAnalysisStats(data: CaseExportData[]): {
        'Time Range': string;
        Type: string;
        Count: number;
        Percentage: string;
    }[];
    static generateFeedbackQualityStats(data: CaseExportData[]): ({
        Metric: string;
        Value: number;
    } | {
        Metric: string;
        Value: string;
    })[] | {
        Analysis: string;
        Value: string;
    }[];
    static generateDateTrendStats(data: CaseExportData[]): {
        Date: string;
        'Total Cases': number;
        'Resolved Cases': number;
        'Resolution Rate': string;
        'Avg Waiting Time': string;
        'Avg Processing Time': string;
    }[] | {
        Period: string;
        Cases: number;
    }[];
    static generateCategoryRatingStats(feedbackData: CaseExportData[]): {
        Metric: string;
        Value: string;
    }[];
    static calculateMedian(numbers: number[]): number | null;
    static workbookToBuffer(workbook: XLSX.WorkBook): Buffer;
    static generateFileName(prefix?: string): string;
}
//# sourceMappingURL=excel.service.d.ts.map