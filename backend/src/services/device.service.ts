import type { KioskDevice } from '@prisma/client';
import { ConflictError, NotFoundError } from '../error';
import { prisma } from "../lib/prisma";
import { DeviceMode, DeviceStatus, DeviceWithStatus, ListFilters } from '../lib/utils/type';
import jwt from "jsonwebtoken";
import { SignalRGateway } from '../signalr';
import type { Prisma } from "@prisma/client";
import { ONLINE_GRACE_MS } from './utils/feedback.constants';


export class DeviceService {
  /**
   * Handle device heartbeat via HTTP API
   * - Updates lastSeenAt timestamp  
   * - Updates isConnected status to true
   * - Returns current device status and lock info
   */
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

    // Update both lastSeenAt and isConnected
    await prisma.kioskDevice.update({
      where: { id: deviceId },
      data: { 
        lastSeenAt: now,
        isConnected: true  // Mark as connected when heartbeat received
      },
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

    const isOnline = await this.isDeviceOnlineDynamic(device.id, device.lastSeenAt);
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
            version: device.currentLock.version,
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

  static isDeviceOnline(lastSeenAt: Date, thresholdMinutes?: number): boolean {
    // Use ONLINE_GRACE_MS constant (120s) if no threshold specified
    const thresholdMs = thresholdMinutes ? thresholdMinutes * 60 * 1000 : ONLINE_GRACE_MS;
    const thresholdTime = Date.now() - thresholdMs;
    return lastSeenAt.getTime() > thresholdTime;
  }

  // services must use SignalR, no connection = offline
  static async isDeviceOnlineDynamic(deviceId: string, lastSeenAt: Date, thresholdMinutes?: number): Promise<boolean> {
    // Hybrid status checking: both isConnected flag AND recent activity required
    const signalRConnected = await this.isDeviceConnectedViaSignalR(deviceId);
    
    if (!signalRConnected) {
      const minutesAgo = Math.floor((Date.now() - lastSeenAt.getTime()) / (1000 * 60));
      console.log(`Device ${deviceId.slice(0, 8)} is OFFLINE - No SignalR connection (last seen ${minutesAgo}min ago)`);
      return false;
    }
    
    // Determine timeout threshold based on device state
    // If not specified, check if device is busy (has active lock) to decide threshold
    let effectiveThreshold = thresholdMinutes;
    
    if (!effectiveThreshold) {
      const device = await prisma.kioskDevice.findUnique({
        where: { id: deviceId },
        select: { currentLockId: true }
      });
      
      // BUSY devices get 5-minute grace period (during feedback collection)
      // IDLE devices get 2-minute timeout
      effectiveThreshold = device?.currentLockId ? 5 : 2;
    }
    
    // Even if isConnected=true, verify lastSeenAt is recent (protect against webhook failures)
    const minutesSinceLastSeen = Math.floor((Date.now() - lastSeenAt.getTime()) / (1000 * 60));
    
    if (minutesSinceLastSeen > effectiveThreshold) {
      console.log(`Device ${deviceId.slice(0, 8)} is OFFLINE - Stale connection (last seen ${minutesSinceLastSeen}min ago, threshold ${effectiveThreshold}min)`);
      return false;
    }
    
    console.log(`Device ${deviceId.slice(0, 8)} is ONLINE - SignalR connected and active (last seen ${minutesSinceLastSeen}min ago, threshold ${effectiveThreshold}min)`);
    return true;
  }

  // check if device has any active SignalR connections (via database isConnected field)
  static async isDeviceConnectedViaSignalR(deviceId: string): Promise<boolean> {
    try {
      const isConnected = await SignalRGateway.isDeviceOnline(deviceId);
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`Device ${deviceId.slice(0, 8)} SignalR: ${isConnected ? 'CONNECTED' : 'DISCONNECTED'}`);
      }
      
      return isConnected;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.log(`SignalR check failed for device ${deviceId.slice(0, 8)}: ${errorMsg}`);
      return false;
    }
  }

  // list all devices with their current status
  static async listDevices(filters: ListFilters = {}): Promise<DeviceWithStatus[]> {
    const { mode, status, thresholdMinutes } = filters;
  
    // DB-side filter for mode
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
  
    // map to DTO + derive online/busy (simplified for serverless)
    const mapped: DeviceWithStatus[] = rows.map((row:any): DeviceWithStatus => {
      // Use ONLINE_GRACE_MS (120s) for consistent online detection unless custom threshold provided
      const isOnline = this.isDeviceOnline(row.lastSeenAt, thresholdMinutes);
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
              version: row.currentLock.version,
              case: {
                id: row.currentLock.case.id,
                zID: row.currentLock.case.zID,
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
      // Use simple online detection for serverless
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
              version: device.currentLock.version,
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
    return devices.filter((d: { isOnline: any; }) => d.isOnline);
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

  static async issueAppJWT(deviceId: string) {
    const device = await prisma.kioskDevice.findUnique({
      where: { id: deviceId }, select: { id: true, mode: true, deletedAt: true }
    });
    if (!device || device.deletedAt) throw new NotFoundError('Device not found');

    const expiresIn = '24h';
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const token = jwt.sign(
      { 
        typ: 'device', 
        sub: device.id, 
        mode: device.mode,
        iat: Math.floor(Date.now() / 1000)
      },
      process.env.JWT_SECRET!,
      { expiresIn }
    );

    return { token, expiresAt };
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
      data: { 
        mode: newMode,
        lastSeenAt: new Date() // Update lastSeenAt when mode changes
      },
      select: { id: true, name: true, mode: true, lastSeenAt: true },
    });

    // notify iPad to switch
    try {
      SignalRGateway.changeModeDevice(deviceId, newMode);
    } catch {
      // SignalR ignore error, not blocking api call
    }

    // Real-time update: Notify dashboard about the mode change
    SignalRGateway.notifyDashboard({
      type: "device:mode_changed",
      payload: { deviceId, mode: newMode }
    });

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
      await tx.kioskDevice.update({
        where: { id: deviceId },
        data: { currentLockId: null },
      });

      // mark deleted at, invlalidate old credentials
      await tx.kioskDevice.update({
        where: { id: deviceId },
        data: {
          deletedAt: new Date(),
          secretHash: "",      // invalidate old api key
        },
      });
    });

    // 🎯 CRITICAL: Send unpair message to BOTH iPad device AND all dashboards
    console.log(`🔄 [Device Unpair] Sending unpair notifications for device: ${deviceId}`);
    
    // 1. Notify the specific iPad device that it's been unpaired
    try {
      console.log(`📱 [Device Unpair] Sending UNPAIRED message to iPad device: ${deviceId}`);
      const deviceUnpairResult = await SignalRGateway.unpairDevice(deviceId);
      console.log(`📱 [Device Unpair] iPad notification result: ${deviceUnpairResult ? 'SUCCESS' : 'FAILED'}`);
    } catch (error) {
      console.error(`❌ [Device Unpair] Failed to notify iPad device ${deviceId}:`, error);
    }

    // Notify all dashboards about the device unpair
    try {
      console.log(`🖥️ [Device Unpair] Broadcasting device:unpaired to all dashboards for device: ${deviceId}`);
      await SignalRGateway.notifyDashboard({
        type: "device:unpaired",
        payload: { deviceId }
      });
      console.log(`🖥️ [Device Unpair] Dashboard broadcast completed successfully`);
    } catch (error) {
      console.error(`❌ [Device Unpair] Failed to notify dashboards about device ${deviceId}:`, error);
    }
    
    console.log(`✅ [Device Unpair] All unpair notifications sent for device: ${deviceId}`);
  }

  static async checkPairingStatus(deviceId: string): Promise<boolean> {
    const device = await prisma.kioskDevice.findUnique({
      where: { id: deviceId },
      select: { id: true, deletedAt: true },
    });
    
    // Device is paired if it exists and hasn't been deleted/unpaired
    return !!(device && !device.deletedAt);
  }

  // update device name
  static async updateDeviceName(deviceId: string, newName: string) {
    if (!newName || newName.trim().length === 0) {
      throw new Error('Device name cannot be empty');
    }

    const device = await prisma.kioskDevice.findUnique({
      where: { id: deviceId },
    });

    if (!device || device.deletedAt) {
      throw new NotFoundError('Device not found');
    }

    const updatedDevice = await prisma.kioskDevice.update({
      where: { id: deviceId },
      data: { name: newName.trim() },
      select: {
        id: true,
        name: true,
        mode: true,
        lastSeenAt: true,
      },
    });

    // Notify dashboard clients about the device name change
    SignalRGateway.notifyDashboard({
      type: 'DEVICE_NAME_UPDATED',
      payload: {
        deviceId: updatedDevice.id,
        name: updatedDevice.name,
        mode: updatedDevice.mode,
        lastSeenAt: updatedDevice.lastSeenAt,
      },
    });

    return {
      success: true,
      device: updatedDevice,
    };
  }
}
