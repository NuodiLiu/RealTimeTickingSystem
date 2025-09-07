// src/controllers/pair.controller.ts
import { Request, Response, NextFunction } from 'express';
import { BadRequestError } from '../error';
import { PairService } from '../services/pair.service';
import type { ListFilters } from '../services/pair.service';

type DeviceStatus = 'OFFLINE' | 'IDLE' | 'BUSY';
type DeviceMode   = 'REGISTRATION' | 'FEEDBACK' | 'DUAL';
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
      const result = await PairService.completePairing(req.body);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }


  static async handleHeartbeat(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.device?.deviceId) throw new BadRequestError('Device authentication required');
      const result = await PairService.handleHeartbeat(req.device.deviceId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }


  static async getDeviceStatus(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.device?.deviceId) throw new BadRequestError('Device authentication required');
      const result = await PairService.getDeviceStatus(req.device.deviceId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }


  static async listDevices(req: Request, res: Response, next: NextFunction) {
    try {
      const mode = req.query.mode as DeviceMode | undefined;
      const statusRaw = (req.query.status as string | undefined)?.toUpperCase();
  
      const status = (statusRaw === 'ONLINE' ||
                      statusRaw === 'OFFLINE' ||
                      statusRaw === 'BUSY' ||
                      statusRaw === 'IDLE')
                    ? statusRaw
                    : undefined;
  
      const filters: ListFilters = {};
      if (mode)   filters.mode = mode;
      if (status) filters.status = status;
  
      const devices = await PairService.listDevices(filters);
      res.status(200).json(devices);
    } catch (err) {
      next(err);
    }
    // try {
    //   const { mode, status } = req.query as { mode?: DeviceMode; status?: string };
    //   let devices: DeviceWithStatus[] = await PairService.listDevices();

    //   if (mode) {
    //     devices = devices.filter((d: DeviceWithStatus) => d.mode === mode);
    //   }
      
    //   if (status) {
    //     devices = devices.filter((d: DeviceWithStatus) => {
    //       if (status === 'ONLINE') return d.isOnline;
    //       if (status === 'OFFLINE') return !d.isOnline;
    //       return d.status === status;
    //     });
    //   }

    //   res.status(200).json(devices);
    // } catch (err) {
    //   next(err);
    // }
  }


  static async getDevicesByMode(req: Request, res: Response, next: NextFunction) {
    try {
      const mode = req.params.mode as DeviceMode;
      const validModes: DeviceMode[] = ['REGISTRATION', 'FEEDBACK', 'DUAL'];
      if (!validModes.includes(mode)) throw new BadRequestError('Invalid device mode');

      const devices = await PairService.getDevicesByMode(mode);
      res.status(200).json({ devices, mode });
    } catch (err) {
      next(err);
    }
  }


  static async getOnlineDevicesByMode(req: Request, res: Response, next: NextFunction) {
    try {
      const mode = req.params.mode as DeviceMode;
      const validModes: DeviceMode[] = ['REGISTRATION', 'FEEDBACK', 'DUAL'];
      if (!validModes.includes(mode)) throw new BadRequestError('Invalid device mode');

      const devices = await PairService.getOnlineDevicesByMode(mode);
      res.status(200).json({ devices, mode, count: devices.length });
    } catch (err) {
      next(err);
    }
  }

}