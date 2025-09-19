"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExcelController = void 0;
const excel_service_1 = require("../services/excel.service");
const error_1 = require("../error");
class ExcelController {
    // export case data to JSON format
    static async exportCasesJson(req, res, next) {
        try {
            const filters = ExcelController.parseFilters(req.query);
            const data = await excel_service_1.ExcelService.getCasesForExport(filters);
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
        }
        catch (error) {
            console.error('Error exporting cases as JSON:', error);
            next(error);
        }
    }
    // export case data to Excel format
    static async exportCasesExcel(req, res, next) {
        try {
            const filters = ExcelController.parseFilters(req.query);
            const data = await excel_service_1.ExcelService.getCasesForExport(filters);
            if (data.length === 0) {
                return res.status(404).json({
                    error: 'No cases found matching the specified criteria'
                });
            }
            const workbook = await excel_service_1.ExcelService.generateExcelWorkbook(data);
            const buffer = excel_service_1.ExcelService.workbookToBuffer(workbook);
            const fileName = excel_service_1.ExcelService.generateFileName('cases_detailed_export');
            // response headers
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
            res.setHeader('Content-Length', buffer.length);
            res.send(buffer);
        }
        catch (error) {
            console.error('Error exporting cases as Excel:', error);
            next(error);
        }
    }
    // export data preview (doesnt generate a file, just return statistics)
    static async getExportPreview(req, res, next) {
        try {
            const filters = ExcelController.parseFilters(req.query);
            const data = await excel_service_1.ExcelService.getCasesForExport(filters);
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
        }
        catch (error) {
            console.error('Error generating export preview:', error);
            next(error);
        }
    }
    // parse and validate filters from query parameters
    static parseFilters(query) {
        const filters = {};
        if (query.status) {
            const statuses = Array.isArray(query.status) ? query.status : [query.status];
            filters.status = statuses.map((s) => s.toUpperCase());
        }
        if (query.startDate) {
            const startDate = new Date(query.startDate);
            if (isNaN(startDate.getTime())) {
                throw new error_1.BadRequestError('Invalid startDate format');
            }
            filters.startDate = startDate;
        }
        if (query.endDate) {
            const endDate = new Date(query.endDate);
            if (isNaN(endDate.getTime())) {
                throw new error_1.BadRequestError('Invalid endDate format');
            }
            endDate.setHours(23, 59, 59, 999);
            filters.endDate = endDate;
        }
        if (query.staffId) {
            filters.staffId = query.staffId;
        }
        if (query.category) {
            filters.category = query.category;
        }
        if (query.hasFeedback && (query.hasFeedback === 'yes' || query.hasFeedback === 'no')) {
            filters.hasFeedback = query.hasFeedback === 'yes';
        }
        return filters;
    }
    // get status distribution statistics
    static getStatusBreakdown(data) {
        const breakdown = {};
        data.forEach(item => {
            breakdown[item.status] = (breakdown[item.status] || 0) + 1;
        });
        return breakdown;
    }
    // get category distribution statistics
    static getCategoryBreakdown(data) {
        const breakdown = {};
        data.forEach(item => {
            breakdown[item.category] = (breakdown[item.category] || 0) + 1;
        });
        return breakdown;
    }
    // get staff distribution statistics
    static getStaffBreakdown(data) {
        const breakdown = {};
        data.forEach(item => {
            if (item.staffName) {
                breakdown[item.staffName] = (breakdown[item.staffName] || 0) + 1;
            }
        });
        return breakdown;
    }
}
exports.ExcelController = ExcelController;
//# sourceMappingURL=excel.controller.js.map