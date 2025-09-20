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
      console.log('🔍 [Controller] POST /cases debug:');
      console.log('- Method:', req.method);
      console.log('- URL:', req.url);
      console.log('- Headers:', JSON.stringify(req.headers));
      console.log('- Body:', JSON.stringify(req.body));
      console.log('- Raw body:', req.rawBody?.toString('utf8') || 'not available');
      console.log('- Body type:', typeof req.body);
      console.log('- Body keys:', Object.keys(req.body || {}));
      
      const created = await CasesService.postCase(req.body);
      res.status(201).json(created);
    } catch (err) {
      console.log('❌ [Controller] Error:', err);
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