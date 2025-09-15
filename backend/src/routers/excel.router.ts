import { Router } from 'express';
import { ExcelController } from '../controllers/excel.controller';
import { requireAuth } from '../middlewares/azure-auth.middleware';
import { requireAdmin, requireStaff } from '../middlewares/auth.middleware';

const router = Router();

/**
 * @route   GET /excel/preview
 * @desc    获取导出数据预览和统计信息
 * @access  Admin only
 * @query   status?: string[] - 过滤状态 (QUEUED, IN_PROGRESS, RESOLVED_PENDING_FEEDBACK, RESOLVED)
 * @query   startDate?: string - 开始日期 (ISO string)
 * @query   endDate?: string - 结束日期 (ISO string)
 * @query   staffId?: string - 工作人员ID
 * @query   category?: string - 案例分类
 * @query   hasFeedback?: string - 反馈过滤 ('yes', 'no')
 */
router.get('/preview', requireAuth, requireAdmin, ExcelController.getExportPreview);

/**
 * @route   GET /excel/cases/json
 * @desc    导出案例数据为JSON格式 (兼容原有API)
 * @access  Admin only
 * @query   同上
 */
router.get('/cases/json', requireAuth, requireAdmin, ExcelController.exportCasesJson);

/**
 * @route   GET /excel/cases/xlsx
 * @desc    导出案例数据为Excel文件
 * @access  Admin only
 * @query   同上
 */
router.get('/cases/xlsx', requireAuth, requireAdmin, ExcelController.exportCasesExcel);

/**
 * @route   GET /excel/cases (默认导出Excel)
 * @desc    导出案例数据为Excel文件 (默认格式)
 * @access  Admin only
 * @query   同上
 */
router.get('/cases', requireAuth, requireAdmin, ExcelController.exportCasesExcel);

export default router;
