import { Router } from 'express';
import { ExcelController } from '../controllers/excel.controller';
import { requireJWTAuth } from '../middlewares/jwt-auth.middleware';
import { requireAdmin, requireStaff } from '../middlewares/auth.middleware';

const router = Router();

// get preview and statistics of exported data
router.get('/preview', requireJWTAuth, requireAdmin, ExcelController.getExportPreview);

//  export case data in JSON format
router.get('/cases/json', requireJWTAuth, requireAdmin, ExcelController.exportCasesJson);

// export case data in Excel format
router.get('/cases/xlsx', requireJWTAuth, requireAdmin, ExcelController.exportCasesExcel);

// export data to excel format (default)
router.get('/cases', requireJWTAuth, requireAdmin, ExcelController.exportCasesExcel);

export default router;
