import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma } from "../lib/prisma";
import { BadRequestError, MissingFieldError, NotFoundError } from "../error";
import type { KioskDevice } from '../../generated/prisma';

export type DeviceMode = 'REGISTRATION' | 'FEEDBACK' | 'DUAL';
export type DeviceStatus = 'OFFLINE' | 'IDLE' | 'BUSY';

export type ListFilters = {
  mode?: DeviceMode;                        
  status?: DeviceStatus | 'ONLINE' | 'OFFLINE';
  thresholdMinutes?: number;
};

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
    case: { id: string; studentName: string; category: string; status: string };
    staffName: string;
    leaseExpireAt: Date;
  } | null;
};


export class PairService {
  // generate qr for kiosk
  static async generateQR() {
    const pairingToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    const session = await prisma.pairingSession.create({
      data: {
        pairingToken,
        expiresAt,
        status: 'PENDING',
      },
    });

    const apiBase = process.env.API_BASE_URL || 'http://localhost:3000';
    const qrData = { pairingToken, apiEndpoint: apiBase };
    const qrUrl = `${apiBase}/pair?data=${encodeURIComponent(JSON.stringify(qrData))}`;

    return { qrUrl, pairingToken, sessionId: session.id, expiresAt };
  }

  // ipad scans qr, completes pairing
  static async completePairing(data: {
    pairingToken: string;
    deviceName: string;
    deviceMode?: DeviceMode;
  }) {
    const { pairingToken, deviceName, deviceMode = 'DUAL' } = data;

    if (!pairingToken || !deviceName) {
      throw new MissingFieldError(['pairingToken', 'deviceName']);
    }

    const session = await prisma.pairingSession.findUnique({
      where: { pairingToken },
    });

    if (!session || session.status !== 'PENDING' || session.expiresAt < new Date()) {
      throw new BadRequestError('Invalid or expired pairing token');
    }

    const deviceSecret = crypto.randomBytes(32).toString('hex');
    const secretHash = crypto.createHash('sha256').update(deviceSecret).digest('hex');

    const device = await prisma.kioskDevice.create({
      data: {
        name: deviceName,
        secretHash,
        mode: deviceMode,
        lastSeenAt: new Date(),
      },
    });

    // update pairing session
    await prisma.pairingSession.update({
      where: { id: session.id },
      data: {
        status: 'COMPLETED',
        deviceId: device.id,
        completedAt: new Date(),
      },
    });

    // generate jwt device credentials
    const deviceCredentials = jwt.sign(
      { deviceId: device.id, deviceSecret, type: 'kiosk_device' },
      process.env.JWT_SECRET!,
      { expiresIn: '365d' }
    );

    return {
      deviceCredentials,
      deviceId: device.id,
      deviceName: device.name,
      deviceMode: device.mode,
      wsEndpoint: `${process.env.WS_BASE_URL || 'ws://localhost:3000'}/ws/device/${device.id}`,
    };
  }

  static async validateDeviceCredentials(token: string) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

      if (decoded.type !== 'kiosk_device') {
        throw new BadRequestError('Invalid credential type');
      }

      const device = await prisma.kioskDevice.findUnique({
        where: { id: decoded.deviceId },
      });
      if (!device) throw new BadRequestError('Device not found');

      const expectedHash = crypto.createHash('sha256').update(decoded.deviceSecret).digest('hex');
      if (device.secretHash !== expectedHash) {
        throw new BadRequestError('Invalid device credentials');
      }

      return { deviceId: decoded.deviceId, device };
    } catch {
      throw new BadRequestError('Invalid or expired credentials');
    }
  }

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

    if (!device) throw new NotFoundError('Device not found');

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

    if (!device) throw new NotFoundError('Device not found');

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
      where: { ...(mode ? { mode } : {}) },
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
  // static async listDevices() {
  //   const devices = await prisma.kioskDevice.findMany({
  //     include: {
  //       currentLock: {
  //         include: {
  //           case: true,
  //           staff: { select: { name: true } },
  //         },
  //       },
  //     },
  //     orderBy: { lastSeenAt: 'desc' },
  //   });

  //   return devices.map((device: any) => { // quick type fix; replace `any` with a proper type later if you like
  //     const isOnline = this.isDeviceOnline(device.lastSeenAt);
  //     const isBusy = device.currentLock?.status === 'ACTIVE';
  //     const status: 'OFFLINE' | 'IDLE' | 'BUSY' = isOnline ? (isBusy ? 'BUSY' : 'IDLE') : 'OFFLINE';

  //     return {
  //       deviceId: device.id,
  //       name: device.name,
  //       mode: device.mode,
  //       status,
  //       isOnline,
  //       lastSeenAt: device.lastSeenAt,
  //       currentLock: device.currentLock
  //         ? {
  //             id: device.currentLock.id,
  //             status: device.currentLock.status,
  //             case: {
  //               id: device.currentLock.case.id,
  //               studentName: device.currentLock.case.studentName,
  //               category: device.currentLock.case.category,
  //               status: device.currentLock.case.status,
  //             },
  //             staffName: device.currentLock.staff.name,
  //             leaseExpireAt: device.currentLock.leaseExpireAt,
  //           }
  //         : null,
  //     };
  //   });
  // }

  // static async cleanupExpiredSessions() {
  //   const deleted = await prisma.pairingSession.deleteMany({
  //     where: { status: 'PENDING', expiresAt: { lt: new Date() } },
  //   });
  //   return { deletedCount: deleted.count };
  // }

  static async getDevicesByMode(mode: DeviceMode) {
    const rows = await prisma.kioskDevice.findMany({
      where: { mode },
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
}