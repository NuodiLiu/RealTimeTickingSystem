import { Router } from 'express';
import { ExcelController } from '../controllers/excel.controller';
import { requireAuth } from '../middlewares/azure-auth.middleware';
import { requireAdmin, requireStaff } from '../middlewares/auth.middleware';

const router = Router();

// get preview and statistics of exported data
router.get('/preview', requireAuth, requireAdmin, ExcelController.getExportPreview);

//  export case data in JSON format
router.get('/cases/json', requireAuth, requireAdmin, ExcelController.exportCasesJson);

// export case data in Excel format
router.get('/cases/xlsx', requireAuth, requireAdmin, ExcelController.exportCasesExcel);

// export data to excel format (default)
router.get('/cases', requireAuth, requireAdmin, ExcelController.exportCasesExcel);

export default router;
