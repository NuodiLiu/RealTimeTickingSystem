import { BadRequestError } from '../error';
import { CasesService } from '../services/cases.service';
import { DeviceGateway } from '../websocket/deviceSocket';
import { prisma } from '../lib/prisma';

export class CasesController {
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
      const caseId = req.params.id;
      
      // 在resolve之前获取case信息，以便确定是否需要发送通知
      const existingCase = await prisma.studentCase.findUnique({
        where: { id: caseId },
        select: { id: true, status: true }
      });
      
      if (!existingCase) {
        throw new BadRequestError('Case not found');
      }
      
      const wasPendingFeedback = existingCase.status === 'RESOLVED_PENDING_FEEDBACK';
      
      // 如果case处于pending_feedback状态，获取相关的设备信息
      let deviceId = null;
      if (wasPendingFeedback) {
        const activeFeedbackSession = await prisma.feedbackSession.findFirst({
          where: {
            caseId: caseId,
            status: { in: ['CREATED', 'DELIVERED'] }
          },
          select: { deviceId: true }
        });
        deviceId = activeFeedbackSession?.deviceId;
      }
      
      // 执行resolve操作
      const updated = await CasesService.resolveCase(caseId);
      
      // 如果case之前处于pending_feedback状态，发送WebSocket通知
      if (wasPendingFeedback && deviceId) {
        // 通知iPad关闭反馈界面
        DeviceGateway.publish(deviceId, {
          type: "DISMISS"
        });
        
        // 通知dashboard更新case和device状态
        DeviceGateway.notifyDashboard({
          type: "case:updated",
          payload: { id: caseId, status: "RESOLVED" }
        });
        
        DeviceGateway.notifyDashboard({
          type: "device:updated", 
          payload: { id: deviceId, isBusy: false }
        });
      }
      
      res.status(200).json(updated);
    } catch (err) {
      next(err);
    }
  }

  static async escalateCase(req: any, res: any, next: any) {
    try {
      const { department } = req.body;
      if (!department) {
        throw new BadRequestError('Department is required for escalation');
      }
      const updated = await CasesService.escalateCase(req.params.id, department);
      res.status(200).json(updated);
    } catch (err) {
      next(err);
    }
  }

}