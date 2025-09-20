// src/controllers/pair.controller.ts
import { Request, Response, NextFunction } from 'express';
import { PairService } from '../services/pair.service';

type DeviceStatus = 'OFFLINE' | 'IDLE' | 'BUSY';
type DeviceMode   = 'REGISTRATION' | 'FEEDBACK';
export type DeviceWithStatus = {
  deviceId: string;
  name: string;
  mode: DeviceMode;
  status: DeviceStatus;
  isOnline: boolean;
  lastSeenAt: Date;
  currentLock: {
    id: string;
    status: string;
    case: {
      id: string;
      studentName: string;
      category: string;
      status: string;
    };
    staffName: string;
    leaseExpireAt: Date;
  } | null;
};

export class PairController {

  static async generateQR(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await PairService.generateQR();
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  // POST /pair/complete
  static async completePairing(req: Request, res: Response, next: NextFunction) {
    try {
      // Workaround for Azure Functions body parsing issue
      let bodyData = req.body;
      if ((!bodyData || Object.keys(bodyData).length === 0) && (req as any).rawBody) {
        try {
          bodyData = JSON.parse((req as any).rawBody.toString('utf8'));
        } catch (parseError) {
          // Continue with empty body if parsing fails
        }
      }
      
      const result = await PairService.completePairing(bodyData);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
}