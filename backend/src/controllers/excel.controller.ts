import { Request, Response, NextFunction } from 'express';
import { ExcelService } from '../services/excel.service';
import { BadRequestError } from '../error';

export class ExcelController {
  
  /**
   * 导出案例数据为JSON格式（原有功能，兼容性保留）
   */
  static async exportCasesJson(req: Request, res: Response, next: NextFunction) {
    try {
      // 解析查询参数
      const filters = ExcelController.parseFilters(req.query);
      
      // 获取数据
      const data = await ExcelService.getCasesForExport(filters);
      
      // 简化格式用于JSON导出（保持与原有API兼容）
      const result = data.map(row => ({
        zID: row.zID,
        studentName: row.studentName,
        category: row.category,
        createTime: row.createdAt,
        takeTime: row.startedAt,
        resolveTime: row.resolvedAt,
        processingTime: row.processingTimeSeconds,
        waitingTime: row.waitingTimeSeconds,
        staffName: row.staffName,
        escalatedTo: row.escalatedTo,
        feedbackRating: row.feedbackRating,
        feedbackComment: row.feedbackComment
      }));

      res.json(result);
    } catch (error) {
      console.error('Error exporting cases as JSON:', error);
      next(error);
    }
  }

  /**
   * 导出案例数据为Excel文件
   */
  static async exportCasesExcel(req: Request, res: Response, next: NextFunction) {
    try {
      // 解析查询参数
      const filters = ExcelController.parseFilters(req.query);
      
      // 获取数据
      const data = await ExcelService.getCasesForExport(filters);
      
      if (data.length === 0) {
        return res.status(404).json({ 
          error: 'No cases found matching the specified criteria' 
        });
      }
      
      // 生成Excel工作簿
      const workbook = await ExcelService.generateExcelWorkbook(data);
      
      // 转换为Buffer
      const buffer = ExcelService.workbookToBuffer(workbook);
      
      // 生成文件名
      const fileName = ExcelService.generateFileName('cases_detailed_export');
      
      // 设置响应头
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Length', buffer.length);
      
      // 发送文件
      res.send(buffer);
      
    } catch (error) {
      console.error('Error exporting cases as Excel:', error);
      next(error);
    }
  }

  /**
   * 获取导出数据的预览（不生成文件，仅返回统计信息）
   */
  static async getExportPreview(req: Request, res: Response, next: NextFunction) {
    try {
      // 解析查询参数
      const filters = ExcelController.parseFilters(req.query);
      
      // 获取数据
      const data = await ExcelService.getCasesForExport(filters);
      
      // 生成预览统计
      const preview = {
        totalCases: data.length,
        dateRange: {
          earliest: data.length > 0 ? Math.min(...data.map(d => d.createdAt.getTime())) : null,
          latest: data.length > 0 ? Math.max(...data.map(d => d.createdAt.getTime())) : null
        },
        statusBreakdown: ExcelController.getStatusBreakdown(data),
        categoryBreakdown: ExcelController.getCategoryBreakdown(data),
        staffBreakdown: ExcelController.getStaffBreakdown(data),
        filters: filters,
        estimatedFileSize: `${Math.round(data.length * 0.5)}KB` // 粗略估算
      };
      
      res.json(preview);
      
    } catch (error) {
      console.error('Error generating export preview:', error);
      next(error);
    }
  }

  /**
   * 解析查询参数为过滤条件
   */
  private static parseFilters(query: any) {
    const filters: any = {};
    
    // 状态过滤
    if (query.status) {
      const statuses = Array.isArray(query.status) ? query.status : [query.status];
      filters.status = statuses.map((s: string) => s.toUpperCase());
    }
    
    // 日期范围过滤
    if (query.startDate) {
      const startDate = new Date(query.startDate);
      if (isNaN(startDate.getTime())) {
        throw new BadRequestError('Invalid startDate format');
      }
      filters.startDate = startDate;
    }
    
    if (query.endDate) {
      const endDate = new Date(query.endDate);
      if (isNaN(endDate.getTime())) {
        throw new BadRequestError('Invalid endDate format');
      }
      // 设置为当天结束时间
      endDate.setHours(23, 59, 59, 999);
      filters.endDate = endDate;
    }
    
    // 工作人员过滤
    if (query.staffId) {
      filters.staffId = query.staffId;
    }
    
    // 分类过滤
    if (query.category) {
      filters.category = query.category;
    }
    
    // 反馈过滤
    if (query.hasFeedback && (query.hasFeedback === 'yes' || query.hasFeedback === 'no')) {
      filters.hasFeedback = query.hasFeedback === 'yes';
    }
    
    return filters;
  }

  /**
   * 获取状态分布统计
   */
  private static getStatusBreakdown(data: any[]) {
    const breakdown: Record<string, number> = {};
    data.forEach(item => {
      breakdown[item.status] = (breakdown[item.status] || 0) + 1;
    });
    return breakdown;
  }

  /**
   * 获取分类分布统计
   */
  private static getCategoryBreakdown(data: any[]) {
    const breakdown: Record<string, number> = {};
    data.forEach(item => {
      breakdown[item.category] = (breakdown[item.category] || 0) + 1;
    });
    return breakdown;
  }

  /**
   * 获取工作人员分布统计
   */
  private static getStaffBreakdown(data: any[]) {
    const breakdown: Record<string, number> = {};
    data.forEach(item => {
      if (item.staffName) {
        breakdown[item.staffName] = (breakdown[item.staffName] || 0) + 1;
      }
    });
    return breakdown;
  }
}
