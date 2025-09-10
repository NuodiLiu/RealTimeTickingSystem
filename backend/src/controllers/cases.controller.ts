import { BadRequestError } from '../error';
import { CasesService } from '../services/cases.service'

export class CasesController {
  static async getQueuedCases(req: any, res: any, next: any) {
    try {
      const statusQuery = req.query.status;
      
      // Validate status parameter
      const validStatuses = ['queued', 'in_progress', 'resolved'];
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
      const created = await CasesService.postCase(req.body);
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
      const updated = await CasesService.resolveCase(req.params.id);
      res.status(200).json(updated);
    } catch (err) {
      next(err);
    }
  }

}