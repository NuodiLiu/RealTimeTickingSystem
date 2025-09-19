"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExcelService = void 0;
const prisma_1 = require("../lib/prisma");
const XLSX = __importStar(require("xlsx"));
class ExcelService {
    // format time as h min s 
    static formatDuration(seconds) {
        if (seconds < 60) {
            return `${Math.round(seconds)}s`;
        }
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.round(seconds % 60);
        if (minutes < 60) {
            return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
        }
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        if (hours < 24) {
            return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
        }
        const days = Math.floor(hours / 24);
        const remainingHours = hours % 24;
        return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
    }
    // calculate time difference in seconds
    static calculateTimeDifference(startTime, endTime) {
        return (endTime.getTime() - startTime.getTime()) / 1000;
    }
    // get all case data for export
    static async getCasesForExport(filters) {
        const whereClause = {};
        if ((filters === null || filters === void 0 ? void 0 : filters.status) && filters.status.length > 0) {
            whereClause.status = { in: filters.status };
        }
        if ((filters === null || filters === void 0 ? void 0 : filters.startDate) || (filters === null || filters === void 0 ? void 0 : filters.endDate)) {
            whereClause.createdAt = {};
            if (filters.startDate) {
                whereClause.createdAt.gte = filters.startDate;
            }
            if (filters.endDate) {
                whereClause.createdAt.lte = filters.endDate;
            }
        }
        if (filters === null || filters === void 0 ? void 0 : filters.staffId) {
            whereClause.staffId = filters.staffId;
        }
        if (filters === null || filters === void 0 ? void 0 : filters.category) {
            whereClause.category = filters.category;
        }
        const cases = await prisma_1.prisma.studentCase.findMany({
            where: whereClause,
            include: {
                staff: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true
                    }
                },
                feedback: {
                    select: {
                        rating: true,
                        comment: true,
                        createdAt: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        let filteredCases = cases;
        if ((filters === null || filters === void 0 ? void 0 : filters.hasFeedback) !== undefined) {
            filteredCases = cases.filter(caseData => {
                const hasFeedback = !!caseData.feedback;
                return hasFeedback === filters.hasFeedback;
            });
        }
        // convert data and calculate metrics
        return filteredCases.map(caseData => {
            var _a, _b, _c;
            const feedback = caseData.feedback;
            let waitingTimeSeconds = null;
            let processingTimeSeconds = null;
            let totalTimeSeconds = null;
            if (caseData.createdAt && caseData.startedAt) {
                waitingTimeSeconds = this.calculateTimeDifference(caseData.createdAt, caseData.startedAt);
            }
            if (caseData.startedAt && caseData.resolvedAt) {
                processingTimeSeconds = this.calculateTimeDifference(caseData.startedAt, caseData.resolvedAt);
            }
            if (caseData.createdAt && caseData.resolvedAt) {
                totalTimeSeconds = this.calculateTimeDifference(caseData.createdAt, caseData.resolvedAt);
            }
            return {
                zID: caseData.zID,
                studentName: caseData.studentName,
                category: caseData.category,
                status: caseData.status,
                createdAt: caseData.createdAt,
                startedAt: caseData.startedAt,
                resolvedAt: caseData.resolvedAt,
                staffId: caseData.staffId,
                staffName: ((_a = caseData.staff) === null || _a === void 0 ? void 0 : _a.name) || null,
                staffEmail: ((_b = caseData.staff) === null || _b === void 0 ? void 0 : _b.email) || null,
                staffRole: ((_c = caseData.staff) === null || _c === void 0 ? void 0 : _c.role) || null,
                escalatedTo: caseData.escalatedTo,
                feedbackRating: (feedback === null || feedback === void 0 ? void 0 : feedback.rating) || null,
                feedbackComment: (feedback === null || feedback === void 0 ? void 0 : feedback.comment) || null,
                feedbackCreatedAt: (feedback === null || feedback === void 0 ? void 0 : feedback.createdAt) || null,
                waitingTimeSeconds,
                processingTimeSeconds,
                totalTimeSeconds,
                waitingTimeFormatted: waitingTimeSeconds ? this.formatDuration(waitingTimeSeconds) : null,
                processingTimeFormatted: processingTimeSeconds ? this.formatDuration(processingTimeSeconds) : null,
                totalTimeFormatted: totalTimeSeconds ? this.formatDuration(totalTimeSeconds) : null,
                hasEscalation: !!caseData.escalatedTo,
                hasFeedback: !!feedback,
                isComplete: !!(caseData.startedAt && caseData.resolvedAt)
            };
        });
    }
    // generate Excel workbook
    static async generateExcelWorkbook(data) {
        const workbook = XLSX.utils.book_new();
        // main data sheet contains all details
        const mainSheetData = data.map(row => {
            var _a, _b, _c;
            return ({
                'Case ID': row.zID || 'N/A',
                'Student Name': row.studentName,
                'Category': row.category,
                'Status': row.status,
                'Created At': row.createdAt.toISOString(),
                'Started At': ((_a = row.startedAt) === null || _a === void 0 ? void 0 : _a.toISOString()) || '',
                'Resolved At': ((_b = row.resolvedAt) === null || _b === void 0 ? void 0 : _b.toISOString()) || '',
                'Staff Name': row.staffName || '',
                'Staff Email': row.staffEmail || '',
                'Staff Role': row.staffRole || '',
                'Escalated To': row.escalatedTo || '',
                'Feedback Rating': row.feedbackRating || '',
                'Feedback Comment': row.feedbackComment || '',
                'Feedback Date': ((_c = row.feedbackCreatedAt) === null || _c === void 0 ? void 0 : _c.toISOString()) || '',
                'Waiting Time (seconds)': row.waitingTimeSeconds || '',
                'Processing Time (seconds)': row.processingTimeSeconds || '',
                'Total Time (seconds)': row.totalTimeSeconds || '',
                'Waiting Time': row.waitingTimeFormatted || '',
                'Processing Time': row.processingTimeFormatted || '',
                'Total Time': row.totalTimeFormatted || '',
                'Has Escalation': row.hasEscalation ? 'Yes' : 'No',
                'Has Feedback': row.hasFeedback ? 'Yes' : 'No',
                'Is Complete': row.isComplete ? 'Yes' : 'No'
            });
        });
        const mainSheet = XLSX.utils.json_to_sheet(mainSheetData);
        XLSX.utils.book_append_sheet(workbook, mainSheet, 'All Cases');
        // summary sheet
        const summaryData = this.generateSummaryStats(data);
        const summarySheet = XLSX.utils.json_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
        // category stats sheet
        const categoryStats = this.generateCategoryStats(data);
        const categorySheet = XLSX.utils.json_to_sheet(categoryStats);
        XLSX.utils.book_append_sheet(workbook, categorySheet, 'By Category');
        // staff stats sheet
        const staffStats = this.generateStaffStats(data);
        const staffSheet = XLSX.utils.json_to_sheet(staffStats);
        XLSX.utils.book_append_sheet(workbook, staffSheet, 'By Staff');
        // time analysis sheet
        const timeAnalysisStats = this.generateTimeAnalysisStats(data);
        const timeAnalysisSheet = XLSX.utils.json_to_sheet(timeAnalysisStats);
        XLSX.utils.book_append_sheet(workbook, timeAnalysisSheet, 'Time Analysis');
        // feedback quality sheet
        const feedbackQualityStats = this.generateFeedbackQualityStats(data);
        const feedbackQualitySheet = XLSX.utils.json_to_sheet(feedbackQualityStats);
        XLSX.utils.book_append_sheet(workbook, feedbackQualitySheet, 'Feedback Quality');
        // date trends sheet
        const dateStats = this.generateDateTrendStats(data);
        const dateSheet = XLSX.utils.json_to_sheet(dateStats);
        XLSX.utils.book_append_sheet(workbook, dateSheet, 'Date Trends');
        return workbook;
    }
    static generateSummaryStats(data) {
        const total = data.length;
        const resolved = data.filter(c => c.status === 'RESOLVED').length;
        const withFeedback = data.filter(c => c.hasFeedback).length;
        const escalated = data.filter(c => c.hasEscalation).length;
        const complete = data.filter(c => c.isComplete).length;
        const avgWaitingTime = this.calculateAverage(data.map(c => c.waitingTimeSeconds).filter(t => t !== null));
        const avgProcessingTime = this.calculateAverage(data.map(c => c.processingTimeSeconds).filter(t => t !== null));
        const avgTotalTime = this.calculateAverage(data.map(c => c.totalTimeSeconds).filter(t => t !== null));
        const avgRating = this.calculateAverage(data.map(c => c.feedbackRating).filter(r => r !== null));
        return [
            { Metric: 'Total Cases', Value: total },
            { Metric: 'Resolved Cases', Value: resolved },
            { Metric: 'Resolution Rate', Value: total > 0 ? `${((resolved / total) * 100).toFixed(1)}%` : '0%' },
            { Metric: 'Cases with Feedback', Value: withFeedback },
            { Metric: 'Feedback Rate', Value: resolved > 0 ? `${((withFeedback / resolved) * 100).toFixed(1)}%` : '0%' },
            { Metric: 'Escalated Cases', Value: escalated },
            { Metric: 'Escalation Rate', Value: total > 0 ? `${((escalated / total) * 100).toFixed(1)}%` : '0%' },
            { Metric: 'Complete Cases', Value: complete },
            { Metric: 'Avg Waiting Time', Value: avgWaitingTime ? this.formatDuration(avgWaitingTime) : 'N/A' },
            { Metric: 'Avg Processing Time', Value: avgProcessingTime ? this.formatDuration(avgProcessingTime) : 'N/A' },
            { Metric: 'Avg Total Time', Value: avgTotalTime ? this.formatDuration(avgTotalTime) : 'N/A' },
            { Metric: 'Avg Rating', Value: avgRating ? avgRating.toFixed(1) : 'N/A' }
        ];
    }
    static generateCategoryStats(data) {
        const categoryMap = new Map();
        data.forEach(caseData => {
            const category = caseData.category;
            if (!categoryMap.has(category)) {
                categoryMap.set(category, []);
            }
            categoryMap.get(category).push(caseData);
        });
        return Array.from(categoryMap.entries()).map(([category, cases]) => {
            const total = cases.length;
            const resolved = cases.filter(c => c.status === 'RESOLVED').length;
            const withFeedback = cases.filter(c => c.hasFeedback).length;
            const escalated = cases.filter(c => c.hasEscalation).length;
            const avgWaitingTime = this.calculateAverage(cases.map(c => c.waitingTimeSeconds).filter(t => t !== null));
            const avgProcessingTime = this.calculateAverage(cases.map(c => c.processingTimeSeconds).filter(t => t !== null));
            const avgRating = this.calculateAverage(cases.map(c => c.feedbackRating).filter(r => r !== null));
            return {
                Category: category,
                'Total Cases': total,
                'Resolved Cases': resolved,
                'Resolution Rate': total > 0 ? `${((resolved / total) * 100).toFixed(1)}%` : '0%',
                'Cases with Feedback': withFeedback,
                'Escalated Cases': escalated,
                'Escalation Rate': total > 0 ? `${((escalated / total) * 100).toFixed(1)}%` : '0%',
                'Avg Waiting Time': avgWaitingTime ? this.formatDuration(avgWaitingTime) : 'N/A',
                'Avg Processing Time': avgProcessingTime ? this.formatDuration(avgProcessingTime) : 'N/A',
                'Avg Rating': avgRating ? avgRating.toFixed(1) : 'N/A'
            };
        });
    }
    static generateStaffStats(data) {
        const staffMap = new Map();
        data.forEach(caseData => {
            if (caseData.staffName) {
                const staffKey = `${caseData.staffName} (${caseData.staffEmail})`;
                if (!staffMap.has(staffKey)) {
                    staffMap.set(staffKey, []);
                }
                staffMap.get(staffKey).push(caseData);
            }
        });
        return Array.from(staffMap.entries()).map(([staffKey, cases]) => {
            const total = cases.length;
            const resolved = cases.filter(c => c.status === 'RESOLVED').length;
            const withFeedback = cases.filter(c => c.hasFeedback).length;
            const escalated = cases.filter(c => c.hasEscalation).length;
            const avgWaitingTime = this.calculateAverage(cases.map(c => c.waitingTimeSeconds).filter(t => t !== null));
            const avgProcessingTime = this.calculateAverage(cases.map(c => c.processingTimeSeconds).filter(t => t !== null));
            const avgRating = this.calculateAverage(cases.map(c => c.feedbackRating).filter(r => r !== null));
            return {
                Staff: staffKey,
                'Total Cases': total,
                'Resolved Cases': resolved,
                'Resolution Rate': total > 0 ? `${((resolved / total) * 100).toFixed(1)}%` : '0%',
                'Cases with Feedback': withFeedback,
                'Escalated Cases': escalated,
                'Avg Waiting Time': avgWaitingTime ? this.formatDuration(avgWaitingTime) : 'N/A',
                'Avg Processing Time': avgProcessingTime ? this.formatDuration(avgProcessingTime) : 'N/A',
                'Avg Rating': avgRating ? avgRating.toFixed(1) : 'N/A'
            };
        });
    }
    static calculateAverage(numbers) {
        if (numbers.length === 0)
            return null;
        return numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
    }
    static generateTimeAnalysisStats(data) {
        const completeData = data.filter(c => c.isComplete);
        // 按时间范围分组
        const timeRanges = [
            { label: 'Very Fast (< 5min)', min: 0, max: 300 },
            { label: 'Fast (5-15min)', min: 300, max: 900 },
            { label: 'Normal (15-30min)', min: 900, max: 1800 },
            { label: 'Slow (30-60min)', min: 1800, max: 3600 },
            { label: 'Very Slow (> 1hour)', min: 3600, max: Infinity }
        ];
        const waitingTimeAnalysis = timeRanges.map(range => {
            const count = data.filter(c => c.waitingTimeSeconds !== null &&
                c.waitingTimeSeconds >= range.min &&
                c.waitingTimeSeconds < range.max).length;
            return {
                'Time Range': range.label,
                'Type': 'Waiting Time',
                'Count': count,
                'Percentage': data.length > 0 ? `${((count / data.length) * 100).toFixed(1)}%` : '0%'
            };
        });
        const processingTimeAnalysis = timeRanges.map(range => {
            const count = completeData.filter(c => c.processingTimeSeconds !== null &&
                c.processingTimeSeconds >= range.min &&
                c.processingTimeSeconds < range.max).length;
            return {
                'Time Range': range.label,
                'Type': 'Processing Time',
                'Count': count,
                'Percentage': completeData.length > 0 ? `${((count / completeData.length) * 100).toFixed(1)}%` : '0%'
            };
        });
        return [...waitingTimeAnalysis, ...processingTimeAnalysis];
    }
    static generateFeedbackQualityStats(data) {
        const feedbackData = data.filter(c => c.hasFeedback && c.feedbackRating !== null);
        if (feedbackData.length === 0) {
            return [{ 'Analysis': 'No feedback data available', 'Value': '' }];
        }
        // group by rating
        const ratingBreakdown = [1, 2, 3, 4, 5].map(rating => {
            const count = feedbackData.filter(c => c.feedbackRating === rating).length;
            return {
                'Rating': `${rating} Star${rating > 1 ? 's' : ''}`,
                'Count': count,
                'Percentage': `${((count / feedbackData.length) * 100).toFixed(1)}%`
            };
        });
        const avgRating = this.calculateAverage(feedbackData.map(c => c.feedbackRating));
        const medianRating = this.calculateMedian(feedbackData.map(c => c.feedbackRating));
        // group by category
        const categoryRatings = this.generateCategoryRatingStats(feedbackData);
        const summaryStats = [
            { 'Metric': 'Total Feedback Received', 'Value': feedbackData.length },
            { 'Metric': 'Average Rating', 'Value': avgRating ? avgRating.toFixed(2) : 'N/A' },
            { 'Metric': 'Median Rating', 'Value': medianRating ? medianRating.toFixed(1) : 'N/A' },
            { 'Metric': 'Feedback Rate', 'Value': `${((feedbackData.length / data.length) * 100).toFixed(1)}%` }
        ];
        return [
            ...summaryStats,
            { 'Metric': '', 'Value': '' },
            ...ratingBreakdown.map(r => ({ 'Metric': r.Rating, 'Value': `${r.Count} (${r.Percentage})` })),
            { 'Metric': '', 'Value': '' },
            ...categoryRatings
        ];
    }
    static generateDateTrendStats(data) {
        if (data.length === 0) {
            return [{ 'Period': 'No data available', 'Cases': 0 }];
        }
        // group by date (daily)
        const dateMap = new Map();
        data.forEach(caseData => {
            const dateKey = caseData.createdAt.toISOString().split('T')[0]; // YYYY-MM-DD
            if (dateKey && !dateMap.has(dateKey)) {
                dateMap.set(dateKey, []);
            }
            if (dateKey) {
                dateMap.get(dateKey).push(caseData);
            }
        });
        const dailyStats = Array.from(dateMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, cases]) => {
            const resolved = cases.filter(c => c.status === 'RESOLVED').length;
            const avgWaitingTime = this.calculateAverage(cases.map(c => c.waitingTimeSeconds).filter(t => t !== null));
            const avgProcessingTime = this.calculateAverage(cases.map(c => c.processingTimeSeconds).filter(t => t !== null));
            return {
                'Date': date,
                'Total Cases': cases.length,
                'Resolved Cases': resolved,
                'Resolution Rate': cases.length > 0 ? `${((resolved / cases.length) * 100).toFixed(1)}%` : '0%',
                'Avg Waiting Time': avgWaitingTime ? this.formatDuration(avgWaitingTime) : 'N/A',
                'Avg Processing Time': avgProcessingTime ? this.formatDuration(avgProcessingTime) : 'N/A'
            };
        });
        return dailyStats;
    }
    static generateCategoryRatingStats(feedbackData) {
        const categoryMap = new Map();
        feedbackData.forEach(c => {
            if (!categoryMap.has(c.category)) {
                categoryMap.set(c.category, []);
            }
            categoryMap.get(c.category).push(c.feedbackRating);
        });
        return Array.from(categoryMap.entries()).map(([category, ratings]) => {
            const avgRating = this.calculateAverage(ratings);
            return {
                'Metric': `${category} Avg Rating`,
                'Value': avgRating ? avgRating.toFixed(2) : 'N/A'
            };
        });
    }
    static calculateMedian(numbers) {
        if (numbers.length === 0)
            return null;
        const sorted = [...numbers].sort((a, b) => a - b);
        const middle = Math.floor(sorted.length / 2);
        if (sorted.length % 2 === 0) {
            const leftVal = sorted[middle - 1];
            const rightVal = sorted[middle];
            if (leftVal !== undefined && rightVal !== undefined) {
                return (leftVal + rightVal) / 2;
            }
            return null;
        }
        else {
            const medianVal = sorted[middle];
            return medianVal !== undefined ? medianVal : null;
        }
    }
    static workbookToBuffer(workbook) {
        return XLSX.write(workbook, {
            type: 'buffer',
            bookType: 'xlsx',
            compression: true
        });
    }
    static generateFileName(prefix = 'cases_export') {
        const now = new Date();
        const timestamp = now.toISOString().split('T')[0];
        return `${prefix}_${timestamp}.xlsx`;
    }
}
exports.ExcelService = ExcelService;
//# sourceMappingURL=excel.service.js.map