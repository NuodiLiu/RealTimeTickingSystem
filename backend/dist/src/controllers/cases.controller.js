"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CasesController = void 0;
const error_1 = require("../error");
const cases_service_1 = require("../services/cases.service");
class CasesController {
    // Public endpoint for display screens 
    static async getPublicQueue(req, res, next) {
        try {
            const publicQueueData = await cases_service_1.CasesService.getPublicQueueData();
            res.status(200).json(publicQueueData);
        }
        catch (err) {
            next(err);
        }
    }
    static async getQueuedCases(req, res, next) {
        try {
            const statusQuery = req.query.status;
            // Validate status parameter
            const validStatuses = ['queued', 'in_progress', 'resolved_pending_feedback', 'resolved'];
            if (statusQuery && !validStatuses.includes(statusQuery.toLowerCase())) {
                throw new error_1.BadRequestError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
            }
            const cases = await cases_service_1.CasesService.getQueuedCases(statusQuery);
            res.status(200).json(cases);
        }
        catch (err) {
            next(err);
        }
    }
    static async postCase(req, res, next) {
        try {
            const created = await cases_service_1.CasesService.postCase(req.body);
            res.status(201).json(created);
        }
        catch (err) {
            next(err);
        }
    }
    static async takeCase(req, res, next) {
        try {
            if (!req.user || !req.user.id) {
                throw new error_1.BadRequestError('User authentication required');
            }
            const taken = await cases_service_1.CasesService.takeCase(req.params.id, req.user.id);
            res.status(200).json(taken);
        }
        catch (err) {
            next(err);
        }
    }
    static async takeNextCase(req, res, next) {
        try {
            if (!req.user || !req.user.id) {
                throw new error_1.BadRequestError('User authentication required');
            }
            const taken = await cases_service_1.CasesService.takeNextCase(req.user.id);
            res.status(200).json(taken);
        }
        catch (err) {
            next(err);
        }
    }
    static async resolveCase(req, res, next) {
        try {
            const caseId = req.params.id;
            const updated = await cases_service_1.CasesService.resolveCase(caseId);
            res.status(200).json(updated);
        }
        catch (err) {
            next(err);
        }
    }
    static async escalateCase(req, res, next) {
        try {
            const { department, resolvedOnSite } = req.body;
            const updated = await cases_service_1.CasesService.escalateCase(req.params.id, department, resolvedOnSite);
            res.status(200).json(updated);
        }
        catch (err) {
            next(err);
        }
    }
}
exports.CasesController = CasesController;
//# sourceMappingURL=cases.controller.js.map