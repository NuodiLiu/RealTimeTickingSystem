import { Request, Response, NextFunction } from 'express';
export declare class ExcelController {
    static exportCasesJson(req: Request, res: Response, next: NextFunction): Promise<void>;
    static exportCasesExcel(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    static getExportPreview(req: Request, res: Response, next: NextFunction): Promise<void>;
    private static parseFilters;
    private static getStatusBreakdown;
    private static getCategoryBreakdown;
    private static getStaffBreakdown;
}
//# sourceMappingURL=excel.controller.d.ts.map