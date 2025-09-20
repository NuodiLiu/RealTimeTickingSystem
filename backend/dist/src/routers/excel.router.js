"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const excel_controller_1 = require("../controllers/excel.controller");
const jwt_auth_middleware_1 = require("../middlewares/jwt-auth.middleware");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
// get preview and statistics of exported data
router.get('/preview', jwt_auth_middleware_1.requireJWTAuth, auth_middleware_1.requireAdmin, excel_controller_1.ExcelController.getExportPreview);
//  export case data in JSON format
router.get('/cases/json', jwt_auth_middleware_1.requireJWTAuth, auth_middleware_1.requireAdmin, excel_controller_1.ExcelController.exportCasesJson);
// export case data in Excel format
router.get('/cases/xlsx', jwt_auth_middleware_1.requireJWTAuth, auth_middleware_1.requireAdmin, excel_controller_1.ExcelController.exportCasesExcel);
// export data to excel format (default)
router.get('/cases', jwt_auth_middleware_1.requireJWTAuth, auth_middleware_1.requireAdmin, excel_controller_1.ExcelController.exportCasesExcel);
exports.default = router;
//# sourceMappingURL=excel.router.js.map