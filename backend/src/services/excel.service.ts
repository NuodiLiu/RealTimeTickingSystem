import { prisma } from "../lib/prisma";
import ExcelJS from 'exceljs';
import { BadRequestError, NotFoundError } from "../error";

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

export class ExcelService {
  
  // format time as h min s 
  static formatDuration(seconds: number): string {
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
  static calculateTimeDifference(startTime: Date, endTime: Date): number {
    return (endTime.getTime() - startTime.getTime()) / 1000;
  }

  // get all case data for export
  static async getCasesForExport(filters?: {
    status?: string[];
    startDate?: Date;
    endDate?: Date;
    staffId?: string;
    category?: string;
    hasFeedback?: boolean;
  }): Promise<CaseExportData[]> {
    
    const whereClause: any = {};
    
    if (filters?.status && filters.status.length > 0) {
      whereClause.status = { in: filters.status };
    }
    
    if (filters?.startDate || filters?.endDate) {
      whereClause.createdAt = {};
      if (filters.startDate) {
        whereClause.createdAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        whereClause.createdAt.lte = filters.endDate;
      }
    }
    
    if (filters?.staffId) {
      whereClause.staffId = filters.staffId;
    }
    
    if (filters?.category) {
      whereClause.category = filters.category;
    }

    const cases = await prisma.studentCase.findMany({
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
    if (filters?.hasFeedback !== undefined) {
      filteredCases = cases.filter(caseData => {
        const hasFeedback = !!caseData.feedback;
        return hasFeedback === filters.hasFeedback;
      });
    }

    // convert data and calculate metrics
    return filteredCases.map(caseData => {
      const feedback = caseData.feedback;
      
      let waitingTimeSeconds: number | null = null;
      let processingTimeSeconds: number | null = null;
      let totalTimeSeconds: number | null = null;
      
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
        staffName: caseData.staff?.name || null,
        staffEmail: caseData.staff?.email || null,
        staffRole: caseData.staff?.role || null,
        
        escalatedTo: caseData.escalatedTo,
        
        feedbackRating: feedback?.rating || null,
        feedbackComment: feedback?.comment || null,
        feedbackCreatedAt: feedback?.createdAt || null,
        
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

  // append a sheet whose columns are derived from the keys of the first row object
  private static appendSheetFromObjects(
    workbook: ExcelJS.Workbook,
    name: string,
    rows: Record<string, any>[]
  ): void {
    const sheet = workbook.addWorksheet(name);
    if (rows.length === 0) return;

    const firstRow = rows[0]!;
    sheet.columns = Object.keys(firstRow).map(key => ({ header: key, key }));
    sheet.addRows(rows);
  }

  // generate Excel workbook
  static async generateExcelWorkbook(data: CaseExportData[]): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();

    // main data sheet contains all details
    const mainSheetData = data.map(row => ({
      'Case ID': row.zID || 'N/A',
      'Student Name': row.studentName,
      'Category': row.category,
      'Status': row.status,
      'Created At': row.createdAt.toISOString(),
      'Started At': row.startedAt?.toISOString() || '',
      'Resolved At': row.resolvedAt?.toISOString() || '',
      'Staff Name': row.staffName || '',
      'Staff Email': row.staffEmail || '',
      'Staff Role': row.staffRole || '',
      'Escalated To': row.escalatedTo || '',
      'Feedback Rating': row.feedbackRating || '',
      'Feedback Comment': row.feedbackComment || '',
      'Feedback Date': row.feedbackCreatedAt?.toISOString() || '',
      'Waiting Time (seconds)': row.waitingTimeSeconds || '',
      'Processing Time (seconds)': row.processingTimeSeconds || '',
      'Total Time (seconds)': row.totalTimeSeconds || '',
      'Waiting Time': row.waitingTimeFormatted || '',
      'Processing Time': row.processingTimeFormatted || '',
      'Total Time': row.totalTimeFormatted || '',
      'Has Escalation': row.hasEscalation ? 'Yes' : 'No',
      'Has Feedback': row.hasFeedback ? 'Yes' : 'No',
      'Is Complete': row.isComplete ? 'Yes' : 'No'
    }));

    this.appendSheetFromObjects(workbook, 'All Cases', mainSheetData);
    this.appendSheetFromObjects(workbook, 'Summary', this.generateSummaryStats(data));
    this.appendSheetFromObjects(workbook, 'By Category', this.generateCategoryStats(data));
    this.appendSheetFromObjects(workbook, 'By Staff', this.generateStaffStats(data));
    this.appendSheetFromObjects(workbook, 'Time Analysis', this.generateTimeAnalysisStats(data));
    this.appendSheetFromObjects(workbook, 'Feedback Quality', this.generateFeedbackQualityStats(data));
    this.appendSheetFromObjects(workbook, 'Date Trends', this.generateDateTrendStats(data));

    return workbook;
  }

  static generateSummaryStats(data: CaseExportData[]) {
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

  static generateCategoryStats(data: CaseExportData[]) {
    const categoryMap = new Map<string, CaseExportData[]>();
    
    data.forEach(caseData => {
      const category = caseData.category;
      if (!categoryMap.has(category)) {
        categoryMap.set(category, []);
      }
      categoryMap.get(category)!.push(caseData);
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

 
  static generateStaffStats(data: CaseExportData[]) {
    const staffMap = new Map<string, CaseExportData[]>();
    
    data.forEach(caseData => {
      if (caseData.staffName) {
        const staffKey = `${caseData.staffName} (${caseData.staffEmail})`;
        if (!staffMap.has(staffKey)) {
          staffMap.set(staffKey, []);
        }
        staffMap.get(staffKey)!.push(caseData);
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


  static calculateAverage(numbers: number[]): number | null {
    if (numbers.length === 0) return null;
    return numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
  }


  static generateTimeAnalysisStats(data: CaseExportData[]) {
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
      const count = data.filter(c => 
        c.waitingTimeSeconds !== null && 
        c.waitingTimeSeconds >= range.min && 
        c.waitingTimeSeconds < range.max
      ).length;
      
      return {
        'Time Range': range.label,
        'Type': 'Waiting Time',
        'Count': count,
        'Percentage': data.length > 0 ? `${((count / data.length) * 100).toFixed(1)}%` : '0%'
      };
    });
    
    const processingTimeAnalysis = timeRanges.map(range => {
      const count = completeData.filter(c => 
        c.processingTimeSeconds !== null && 
        c.processingTimeSeconds >= range.min && 
        c.processingTimeSeconds < range.max
      ).length;
      
      return {
        'Time Range': range.label,
        'Type': 'Processing Time',
        'Count': count,
        'Percentage': completeData.length > 0 ? `${((count / completeData.length) * 100).toFixed(1)}%` : '0%'
      };
    });
    
    return [...waitingTimeAnalysis, ...processingTimeAnalysis];
  }


  static generateFeedbackQualityStats(data: CaseExportData[]) {
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
    
    const avgRating = this.calculateAverage(feedbackData.map(c => c.feedbackRating!));
    const medianRating = this.calculateMedian(feedbackData.map(c => c.feedbackRating!));

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


  static generateDateTrendStats(data: CaseExportData[]) {
    if (data.length === 0) {
      return [{ 'Period': 'No data available', 'Cases': 0 }];
    }

    // group by date (daily)
    const dateMap = new Map<string, CaseExportData[]>();
    
    data.forEach(caseData => {
      const dateKey = caseData.createdAt.toISOString().split('T')[0]; // YYYY-MM-DD
      if (dateKey && !dateMap.has(dateKey)) {
        dateMap.set(dateKey, []);
      }
      if (dateKey) {
        dateMap.get(dateKey)!.push(caseData);
      }
    });
    
    const dailyStats = Array.from(dateMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, cases]) => {
        const resolved = cases.filter(c => c.status === 'RESOLVED').length;
        const avgWaitingTime = this.calculateAverage(
          cases.map(c => c.waitingTimeSeconds).filter(t => t !== null)
        );
        const avgProcessingTime = this.calculateAverage(
          cases.map(c => c.processingTimeSeconds).filter(t => t !== null)
        );
        
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

  static generateCategoryRatingStats(feedbackData: CaseExportData[]) {
    const categoryMap = new Map<string, number[]>();
    
    feedbackData.forEach(c => {
      if (!categoryMap.has(c.category)) {
        categoryMap.set(c.category, []);
      }
      categoryMap.get(c.category)!.push(c.feedbackRating!);
    });
    
    return Array.from(categoryMap.entries()).map(([category, ratings]) => {
      const avgRating = this.calculateAverage(ratings);
      return {
        'Metric': `${category} Avg Rating`,
        'Value': avgRating ? avgRating.toFixed(2) : 'N/A'
      };
    });
  }

  static calculateMedian(numbers: number[]): number | null {
    if (numbers.length === 0) return null;
    
    const sorted = [...numbers].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
      const leftVal = sorted[middle - 1];
      const rightVal = sorted[middle];
      if (leftVal !== undefined && rightVal !== undefined) {
        return (leftVal + rightVal) / 2;
      }
      return null;
    } else {
      const medianVal = sorted[middle];
      return medianVal !== undefined ? medianVal : null;
    }
  }


  static async workbookToBuffer(workbook: ExcelJS.Workbook): Promise<Buffer> {
    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer as ArrayBuffer);
  }

  static generateFileName(prefix: string = 'cases_export'): string {
    const now = new Date();
    const timestamp = now.toISOString().split('T')[0]; 
    return `${prefix}_${timestamp}.xlsx`;
  }
}
