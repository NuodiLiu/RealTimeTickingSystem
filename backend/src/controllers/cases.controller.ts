import { BadRequestError } from '../error';
import { CasesService } from '../services/cases.service';

export class CasesController {
  // Public endpoint for display screens 
  static async getPublicQueue(req: any, res: any, next: any) {
    try {
      const publicQueueData = await CasesService.getPublicQueueData();
      res.status(200).json(publicQueueData);
    } catch (err) {
      next(err);
    }
  }

  static async getQueuedCases(req: any, res: any, next: any) {
    try {
      const statusQuery = req.query.status;
      
      // Validate status parameter
      const validStatuses = ['queued', 'in_progress', 'resolved_pending_feedback', 'resolved'];
      if (statusQuery && !validStatuses.includes(statusQuery.toLowerCase())) {
          throw new BadRequestError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
      }
      
      const cases = await CasesService.getQueuedCases(statusQuery);
      res.status(200).json(cases);
    } catch (err) {
      next(err);
    }
  }

  static async postCase(req: any, res: any, next: any) {
    try {
      // Workaround for Azure Functions body parsing issue
      let bodyData = req.body;
      if ((!bodyData || Object.keys(bodyData).length === 0) && req.rawBody) {
        try {
          bodyData = JSON.parse(req.rawBody.toString('utf8'));
        } catch (parseError) {
          // Continue with empty body if parsing fails
        }
      }
      
      const created = await CasesService.postCase(bodyData);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  }

  static async takeCase(req: any, res: any, next: any) {
    try {
      if (!req.user || !req.user.id) {
        throw new BadRequestError('User authentication required');
      }
      
      const taken = await CasesService.takeCase(req.params.id, req.user.id);
      res.status(200).json(taken);
    } catch (err) {
      next(err);
    }
  }

  static async takeNextCase(req: any, res: any, next: any) {
    try {
      if (!req.user || !req.user.id) {
        throw new BadRequestError('User authentication required');
      }

      const taken = await CasesService.takeNextCase(req.user.id);
      res.status(200).json(taken);
    } catch (err) {
      next(err);
    }
  }

  static async resolveCase(req: any, res: any, next: any) {
    try {
      const caseId = req.params.id;
      
      const updated = await CasesService.resolveCase(caseId);
      
      res.status(200).json(updated);
    } catch (err) {
      next(err);
    }
  }

  static async escalateCase(req: any, res: any, next: any) {
    try {
      const { department, resolvedOnSite } = req.body;
      const updated = await CasesService.escalateCase(req.params.id, department, resolvedOnSite);
      res.status(200).json(updated);
    } catch (err) {
      next(err);
    }
  }

}