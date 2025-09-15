import { prisma } from "../lib/prisma";
import * as XLSX from 'xlsx';
import { BadRequestError, NotFoundError } from "../error";

export interface CaseExportData {
  // 基础信息
  zID: string;
  studentName: string;
  category: string;
  status: string;
  
  // 时间信息
  createdAt: Date;
  startedAt: Date | null;
  resolvedAt: Date | null;
  
  // 工作人员信息
  staffId: string | null;
  staffName: string | null;
  staffEmail: string | null;
  staffRole: string | null;
  
  // 升级信息
  escalatedTo: string | null;
  
  // 反馈信息
  feedbackRating: number | null;
  feedbackComment: string | null;
  feedbackCreatedAt: Date | null;
  
  // 计算的衍生指标
  waitingTimeSeconds: number | null;
  processingTimeSeconds: number | null;
  totalTimeSeconds: number | null;
  waitingTimeFormatted: string | null;
  processingTimeFormatted: string | null;
  totalTimeFormatted: string | null;
  
  // 状态标志
  hasEscalation: boolean;
  hasFeedback: boolean;
  isComplete: boolean;
}

export class ExcelService {
  
  /**
   * 格式化时间为可读字符串 (例如: "2h 30m" 或 "45m 20s")
   */
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

  /**
   * 计算时间差（秒）
   */
  static calculateTimeDifference(startTime: Date, endTime: Date): number {
    return (endTime.getTime() - startTime.getTime()) / 1000;
  }

  /**
   * 获取所有案例数据进行导出
   */
  static async getCasesForExport(filters?: {
    status?: string[];
    startDate?: Date;
    endDate?: Date;
    staffId?: string;
    category?: string;
    hasFeedback?: boolean;
  }): Promise<CaseExportData[]> {
    
    // 构建查询条件
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

    // 查询数据库
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

    // 根据反馈过滤进行后处理过滤（因为Prisma不能直接基于关联存在性过滤）
    let filteredCases = cases;
    if (filters?.hasFeedback !== undefined) {
      filteredCases = cases.filter(caseData => {
        const hasFeedback = !!caseData.feedback;
        return hasFeedback === filters.hasFeedback;
      });
    }

    // 转换数据并计算衍生指标
    return filteredCases.map(caseData => {
      const feedback = caseData.feedback;
      
      // 计算时间指标
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
        // 基础信息
        zID: caseData.zID,
        studentName: caseData.studentName,
        category: caseData.category,
        status: caseData.status,
        
        // 时间信息
        createdAt: caseData.createdAt,
        startedAt: caseData.startedAt,
        resolvedAt: caseData.resolvedAt,
        
        // 工作人员信息
        staffId: caseData.staffId,
        staffName: caseData.staff?.name || null,
        staffEmail: caseData.staff?.email || null,
        staffRole: caseData.staff?.role || null,
        
        // 升级信息
        escalatedTo: caseData.escalatedTo,
        
        // 反馈信息
        feedbackRating: feedback?.rating || null,
        feedbackComment: feedback?.comment || null,
        feedbackCreatedAt: feedback?.createdAt || null,
        
        // 计算的衍生指标
        waitingTimeSeconds,
        processingTimeSeconds,
        totalTimeSeconds,
        waitingTimeFormatted: waitingTimeSeconds ? this.formatDuration(waitingTimeSeconds) : null,
        processingTimeFormatted: processingTimeSeconds ? this.formatDuration(processingTimeSeconds) : null,
        totalTimeFormatted: totalTimeSeconds ? this.formatDuration(totalTimeSeconds) : null,
        
        // 状态标志
        hasEscalation: !!caseData.escalatedTo,
        hasFeedback: !!feedback,
        isComplete: !!(caseData.startedAt && caseData.resolvedAt)
      };
    });
  }

  /**
   * 生成Excel工作簿
   */
  static async generateExcelWorkbook(data: CaseExportData[]): Promise<XLSX.WorkBook> {
    const workbook = XLSX.utils.book_new();
    
    // 主数据表 - 包含所有详细信息
    const mainSheetData = data.map(row => ({
      'Case ID': row.zID,
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
    
    const mainSheet = XLSX.utils.json_to_sheet(mainSheetData);
    XLSX.utils.book_append_sheet(workbook, mainSheet, 'All Cases');
    
    // 汇总统计表
    const summaryData = this.generateSummaryStats(data);
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
    
    // 按分类统计表
    const categoryStats = this.generateCategoryStats(data);
    const categorySheet = XLSX.utils.json_to_sheet(categoryStats);
    XLSX.utils.book_append_sheet(workbook, categorySheet, 'By Category');
    
    // 按工作人员统计表
    const staffStats = this.generateStaffStats(data);
    const staffSheet = XLSX.utils.json_to_sheet(staffStats);
    XLSX.utils.book_append_sheet(workbook, staffSheet, 'By Staff');
    
    // 时间分析表
    const timeAnalysisStats = this.generateTimeAnalysisStats(data);
    const timeAnalysisSheet = XLSX.utils.json_to_sheet(timeAnalysisStats);
    XLSX.utils.book_append_sheet(workbook, timeAnalysisSheet, 'Time Analysis');
    
    // 反馈质量分析表
    const feedbackQualityStats = this.generateFeedbackQualityStats(data);
    const feedbackQualitySheet = XLSX.utils.json_to_sheet(feedbackQualityStats);
    XLSX.utils.book_append_sheet(workbook, feedbackQualitySheet, 'Feedback Quality');
    
    // 日期趋势分析表
    const dateStats = this.generateDateTrendStats(data);
    const dateSheet = XLSX.utils.json_to_sheet(dateStats);
    XLSX.utils.book_append_sheet(workbook, dateSheet, 'Date Trends');
    
    return workbook;
  }

  /**
   * 生成汇总统计数据
   */
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

  /**
   * 生成按分类统计数据
   */
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

  /**
   * 生成按工作人员统计数据
   */
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

  /**
   * 计算平均值
   */
  static calculateAverage(numbers: number[]): number | null {
    if (numbers.length === 0) return null;
    return numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
  }

  /**
   * 生成时间分析统计数据
   */
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

  /**
   * 生成反馈质量分析统计数据
   */
  static generateFeedbackQualityStats(data: CaseExportData[]) {
    const feedbackData = data.filter(c => c.hasFeedback && c.feedbackRating !== null);
    
    if (feedbackData.length === 0) {
      return [{ 'Analysis': 'No feedback data available', 'Value': '' }];
    }
    
    // 按评分分组
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
    
    // 按分类的平均评分
    const categoryRatings = this.generateCategoryRatingStats(feedbackData);
    
    const summaryStats = [
      { 'Metric': 'Total Feedback Received', 'Value': feedbackData.length },
      { 'Metric': 'Average Rating', 'Value': avgRating ? avgRating.toFixed(2) : 'N/A' },
      { 'Metric': 'Median Rating', 'Value': medianRating ? medianRating.toFixed(1) : 'N/A' },
      { 'Metric': 'Feedback Rate', 'Value': `${((feedbackData.length / data.length) * 100).toFixed(1)}%` }
    ];
    
    return [
      ...summaryStats,
      { 'Metric': '', 'Value': '' }, // 空行分隔
      ...ratingBreakdown.map(r => ({ 'Metric': r.Rating, 'Value': `${r.Count} (${r.Percentage})` })),
      { 'Metric': '', 'Value': '' }, // 空行分隔
      ...categoryRatings
    ];
  }

  /**
   * 生成日期趋势分析统计数据
   */
  static generateDateTrendStats(data: CaseExportData[]) {
    if (data.length === 0) {
      return [{ 'Period': 'No data available', 'Cases': 0 }];
    }
    
    // 按日期分组 (按天)
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

  /**
   * 生成按分类的评分统计
   */
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

  /**
   * 计算中位数
   */
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

  /**
   * 将Excel工作簿转换为Buffer
   */
  static workbookToBuffer(workbook: XLSX.WorkBook): Buffer {
    return XLSX.write(workbook, { 
      type: 'buffer', 
      bookType: 'xlsx',
      compression: true 
    });
  }

  /**
   * 生成文件名
   */
  static generateFileName(prefix: string = 'cases_export'): string {
    const now = new Date();
    const timestamp = now.toISOString().split('T')[0]; // YYYY-MM-DD
    return `${prefix}_${timestamp}.xlsx`;
  }
}
