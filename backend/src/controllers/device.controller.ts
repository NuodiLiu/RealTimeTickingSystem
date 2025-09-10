import { Request, Response, NextFunction } from 'express';
import { BadRequestError } from "../error";
import { DeviceService } from "../services/device.service";
import { DeviceMode, ListFilters } from '../lib/utils/type';

export class DeviceController {
    static async handleHeartbeat(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.device?.deviceId) throw new BadRequestError('Device authentication required');
      const result = await DeviceService.handleHeartbeat(req.device.deviceId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }


  static async getDeviceStatus(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.device?.deviceId) throw new BadRequestError('Device authentication required');
      const result = await DeviceService.getDeviceStatus(req.device.deviceId);
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
  
      const devices = await DeviceService.listDevices(filters);
      res.status(200).json(devices);
    } catch (err) {
      next(err);
    }
  }


  static async getDevicesByMode(req: Request, res: Response, next: NextFunction) {
    try {
      const mode = req.params.mode as DeviceMode;
      const validModes: DeviceMode[] = ['REGISTRATION', 'FEEDBACK'];
      if (!validModes.includes(mode)) throw new BadRequestError('Invalid device mode');

      const devices = await DeviceService.getDevicesByMode(mode);
      res.status(200).json({ devices, mode });
    } catch (err) {
      next(err);
    }
  }


  static async getOnlineDevicesByMode(req: Request, res: Response, next: NextFunction) {
    try {
      const mode = req.params.mode as DeviceMode;
      const validModes: DeviceMode[] = ['REGISTRATION', 'FEEDBACK'];
      if (!validModes.includes(mode)) throw new BadRequestError('Invalid device mode');

      const devices = await DeviceService.getOnlineDevicesByMode(mode);
      res.status(200).json({ devices, mode, count: devices.length });
    } catch (err) {
      next(err);
    }
  }

  static async issueWsToken(req: Request, res: Response, next: NextFunction) {
    try {
      const deviceId = req.device?.deviceId;
      if (!deviceId) throw new BadRequestError('Device authentication required'); // ✅ 显式抛 400

      const token = await DeviceService.issueWsToken(deviceId);
      res.status(200).json({ deviceToken: token, expiresIn: 12 * 60 * 60 });
    } catch (err) {
      next(err);
    }
  }

  static async changeMode(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { mode } = req.body as { mode?: 'REGISTRATION' | 'FEEDBACK' };
      if (!id) throw new BadRequestError('id required');
      if (!mode) throw new BadRequestError('mode required');

      const result = await DeviceService.changeMode(id, mode);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async unpairDevice(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (!id) throw new BadRequestError('id required');
      
      await DeviceService.unpair(id);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  }
}