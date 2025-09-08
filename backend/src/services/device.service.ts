import type { KioskDevice } from '../../generated/prisma';
import { ConflictError, NotFoundError } from '../error';
import { prisma } from "../lib/prisma";
import { DeviceMode, DeviceStatus, DeviceWithStatus, ListFilters } from '../lib/utils/type';
import jwt from "jsonwebtoken";
import { DeviceGateway } from '../websocket/deviceSocket';
import type { Prisma } from "@prisma/client";


export class DeviceService {
  // handle heartbeat, updates lastSeenAt and gets curr status
  static async handleHeartbeat(deviceId: string) {
    const now = new Date();
    const device = await prisma.kioskDevice.findUnique({
      where: { id: deviceId },
      include: {
        currentLock: {
          include: {
            case: true,
            staff: { select: { name: true } },
          },
        },
      },
    });

    if (!device || device.deletedAt) throw new NotFoundError('Device not found');

    await prisma.kioskDevice.update({
      where: { id: deviceId },
      data: { lastSeenAt: now },
    });

    let status: 'IDLE' | 'BUSY' = 'IDLE';
    if (device.currentLock && device.currentLock.status === 'ACTIVE') {
      status = 'BUSY';
    }

    return {
      success: true,
      status,
      deviceMode: device.mode,
      timestamp: now,
      currentLock: device.currentLock
        ? {
            id: device.currentLock.id,
            status: device.currentLock.status,
            case: {
              id: device.currentLock.case.id,
              studentName: device.currentLock.case.studentName,
              category: device.currentLock.case.category,
              status: device.currentLock.case.status,
            },
            staffName: device.currentLock.staff.name,
            leaseExpireAt: device.currentLock.leaseExpireAt,
          }
        : null,
    };
  }

  // get device status with current lock
  static async getDeviceStatus(deviceId: string) {
    const device = await prisma.kioskDevice.findUnique({
      where: { id: deviceId },
      include: {
        currentLock: {
          include: {
            case: true,
            staff: { select: { name: true } },
          },
        },
      },
    });

    if (!device || device.deletedAt) throw new NotFoundError('Device not found');

    const isOnline = this.isDeviceOnline(device.lastSeenAt);
    const isBusy = device.currentLock?.status === 'ACTIVE';
    const status: 'OFFLINE' | 'IDLE' | 'BUSY' = isOnline ? (isBusy ? 'BUSY' : 'IDLE') : 'OFFLINE';

    return {
      deviceId: device.id,
      name: device.name,
      mode: device.mode,
      status,
      isOnline,
      lastSeenAt: device.lastSeenAt,
      currentLock: device.currentLock
        ? {
            id: device.currentLock.id,
            status: device.currentLock.status,
            case: {
              id: device.currentLock.case.id,
              studentName: device.currentLock.case.studentName,
              category: device.currentLock.case.category,
              status: device.currentLock.case.status,
            },
            staffName: device.currentLock.staff.name,
            leaseExpireAt: device.currentLock.leaseExpireAt,
          }
        : null,
    };
  }

  static isDeviceOnline(lastSeenAt: Date, thresholdMinutes = 2): boolean {
    const thresholdTime = Date.now() - thresholdMinutes * 60 * 1000;
    return lastSeenAt.getTime() > thresholdTime;
  }

  // list all devices with their current status
  static async listDevices(filters: ListFilters = {}): Promise<DeviceWithStatus[]> {
    const { mode, status, thresholdMinutes = 2 } = filters;
  
    // DB-side filter for mode (cheap); online/busy needs app logic
    const rows = await prisma.kioskDevice.findMany({
      where: { ...(mode ? { mode } : {}), deletedAt: null },
      include: {
        currentLock: {
          include: {
            case: true,
            staff: { select: { name: true } },
          },
        },
      },
      orderBy: { lastSeenAt: 'desc' },
    });
  
    // map to DTO + derive online/busy
    const mapped: DeviceWithStatus[] = rows.map((row:any): DeviceWithStatus => {
      const isOnline =
        row.lastSeenAt.getTime() > Date.now() - thresholdMinutes * 60 * 1000;
      const isBusy = row.currentLock?.status === 'ACTIVE';
      const derivedStatus: DeviceStatus = isOnline ? (isBusy ? 'BUSY' : 'IDLE') : 'OFFLINE';
  
      return {
        deviceId: row.id,
        name: row.name,
        mode: row.mode as DeviceMode,
        status: derivedStatus,
        isOnline,
        lastSeenAt: row.lastSeenAt,
        currentLock: row.currentLock
          ? {
              id: row.currentLock.id,
              status: row.currentLock.status,
              case: {
                id: row.currentLock.case.id,
                studentName: row.currentLock.case.studentName,
                category: row.currentLock.case.category,
                status: row.currentLock.case.status,
              },
              staffName: row.currentLock.staff.name,
              leaseExpireAt: row.currentLock.leaseExpireAt,
            }
          : null,
      };
    });
  
    // apply remaining filters in memory
    if (!status) return mapped;
  
    if (status === 'ONLINE') return mapped.filter((d) => d.isOnline);
    if (status === 'OFFLINE') return mapped.filter((d) => !d.isOnline);
    return mapped.filter((d) => d.status === status); // BUSY or IDLE
  }

  static async getDevicesByMode(mode: DeviceMode) {
    const rows = await prisma.kioskDevice.findMany({
      where: { mode, deletedAt: null },
      include: {
        currentLock: {
          include: {
            case: true,
            staff: { select: { name: true } },
          },
        },
      },
      orderBy: { lastSeenAt: 'desc' },
    });

    return rows.map((device: any) => {
      const isOnline = this.isDeviceOnline(device.lastSeenAt);
      const isBusy = device.currentLock?.status === 'ACTIVE';
      const status: 'OFFLINE' | 'IDLE' | 'BUSY' = isOnline ? (isBusy ? 'BUSY' : 'IDLE') : 'OFFLINE';
      return {
        deviceId: device.id,
        name: device.name,
        mode: device.mode,
        status,
        isOnline,
        lastSeenAt: device.lastSeenAt,
        currentLock: device.currentLock
          ? {
              id: device.currentLock.id,
              status: device.currentLock.status,
              case: {
                id: device.currentLock.case.id,
                studentName: device.currentLock.case.studentName,
                category: device.currentLock.case.category,
                status: device.currentLock.case.status,
              },
              staffName: device.currentLock.staff.name,
              leaseExpireAt: device.currentLock.leaseExpireAt,
            }
          : null,
      };
    });
  }

  static async getOnlineDevicesByMode(mode: DeviceMode) {
    const devices = await this.getDevicesByMode(mode);
    return devices.filter((d: KioskDevice & { isOnline: boolean }) => d.isOnline);
  }

  static async issueWsToken(deviceId: string) {
    const device = await prisma.kioskDevice.findUnique({
      where: { id: deviceId }, select: { id: true, mode: true, deletedAt: true }
    });
    if (!device || device.deletedAt) throw new NotFoundError('Device not found');

    const token = jwt.sign(
      { typ: 'device', sub: device.id, mode: device.mode },
      process.env.JWT_SECRET!,
      { expiresIn: '12h' }
    );

    return token
  }

  static async changeMode(deviceId: string, newMode: DeviceMode) {
    const device = await prisma.kioskDevice.findUnique({
      where: { id: deviceId },
      include: { currentLock: true },
    });
    if (!device || device.deletedAt) throw new NotFoundError('Device not found');

    if (device.currentLock?.status === 'ACTIVE') {
      throw new ConflictError('Device is in an ACTIVE session; please end it before changing mode');
    }

    const updated = await prisma.kioskDevice.update({
      where: { id: deviceId },
      data: { mode: newMode },
      select: { id: true, name: true, mode: true, lastSeenAt: true },
    });

    // notify iPad to switch
    try {
      DeviceGateway.publish(deviceId, { type: "MODE_CHANGED", payload: { mode: newMode } });
    } catch {
      // WS ignore error, not blocking api call
    }

    return updated;
  }

  static async unpair(deviceId: string) {
    const device = await prisma.kioskDevice.findUnique({
      where: { id: deviceId },
      include: { currentLock: true },
    });
    if (!device || device.deletedAt) throw new NotFoundError('Device not found');

    if (device.currentLock?.status === 'ACTIVE') {
      throw new ConflictError('Device is in an ACTIVE session; please end it before unpairing');
    }

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1) 清空指针，避免外键问题
      await tx.kioskDevice.update({
        where: { id: deviceId },
        data: { currentLockId: null },
      });

      // 2) 软删除：标记 deletedAt，并让旧凭证立即失效
      await tx.kioskDevice.update({
        where: { id: deviceId },
        data: {
          deletedAt: new Date(),
          secretHash: null,      // ✅ 直接让旧 API key 失效
        },
      });
    });

    // 3) 通知 iPad 客户端自退（若在线）
    try { 
      DeviceGateway.publish(deviceId, { type: "UNPAIRED" });
    } catch {
      // ignore
    };
  }
}
