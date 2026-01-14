import { signalRClient } from './client';
import { prisma } from '../lib/prisma';
import { DeviceToServer, DeviceMode } from './types';

export class SignalREventHandler {
  
  // Handle device connection events - serverless compatible
  public async handleDeviceConnect(deviceId: string, connectionId: string, mode: DeviceMode): Promise<void> {
    try {
      console.log(`Device ${deviceId} connecting to SignalR with mode ${mode}`);
      
      // In userId mode, no group management needed - device is identified by userId (deviceId)
      console.log(`Device ${deviceId} identified by userId - no group management needed`);
      
      // Update device status in database
      const device = await prisma.kioskDevice.upsert({
        where: { id: deviceId },
        update: { 
          isConnected: true,
          lastSeenAt: new Date(),
          mode: mode
        },
        create: {
          id: deviceId,
          name: `Device ${deviceId}`,
          secretHash: 'signalr-device', // This should be properly generated
          isConnected: true,
          lastSeenAt: new Date(),
          mode: mode
        }
      });

      // Notify dashboard about device connection
      await signalRClient.notifyDashboard({
        type: "device:connected",
        payload: { deviceId, mode, isOnline: true }
      });

      console.log(`Device ${deviceId} successfully connected via SignalR`);
    } catch (error) {
      console.error(`Error handling device connect for ${deviceId}:`, error);
    }
  }

  // Handle device disconnection events - serverless compatible
  public async handleDeviceDisconnect(deviceId: string, connectionId: string): Promise<void> {
    try {
      console.log(`Device ${deviceId} disconnecting from SignalR`);
      
      // Check if device has active lock that needs cleanup
      const device = await prisma.kioskDevice.findUnique({
        where: { id: deviceId },
        include: {
          currentLock: true
        }
      });

      // Clean up active resources if device was in use
      if (device?.currentLock && device.currentLock.status === 'ACTIVE') {
        const lock = device.currentLock;
        const caseId = lock.caseId;

        console.log(`Device ${deviceId} had an active lock ${lock.id} for case ${caseId}. Cleaning up due to disconnect.`);
        
        await prisma.$transaction(async (tx) => {
          // 1. Resolve the associated case if it's not already resolved
          const currentCase = await tx.studentCase.findUnique({ where: { id: caseId } });
          if (currentCase?.status !== 'RESOLVED') {
            await tx.studentCase.update({
              where: { id: caseId },
              data: {
                status: 'RESOLVED',
                resolvedAt: new Date(),
              },
            });
          }

          // 2. Mark the lock as EXPIRED
          await tx.kioskLock.update({
            where: { id: lock.id },
            data: { status: 'EXPIRED' },
          });

          // 3. Release the device
          await tx.kioskDevice.update({
            where: { id: deviceId },
            data: { 
              currentLockId: null,
              isConnected: false,
              lastSeenAt: new Date()
            },
          });

          // 4. Cancel any pending feedback sessions for this case/device
          await tx.feedbackSession.updateMany({
            where: {
              caseId: caseId,
              deviceId: deviceId,
              status: { in: ['CREATED', 'DELIVERED'] }
            },
            data: {
              status: 'CANCELLED'
            }
          });
        });

        console.log(`Cleaned up resources for case ${caseId} and device ${deviceId}.`);
        
        // Notify dashboard about case resolution and device release
        await signalRClient.notifyDashboard({
          type: "case:updated",
          payload: { id: caseId, status: "RESOLVED" }
        });
        
        await signalRClient.notifyDashboard({
          type: "device:updated",
          payload: { id: deviceId, isBusy: false, isOnline: false }
        });
      } else {
        // No active lock, just update device status
        await prisma.kioskDevice.update({
          where: { id: deviceId },
          data: { 
            isConnected: false,
            lastSeenAt: new Date()
          }
        });
      }

      // Notify dashboard about device disconnection
      await signalRClient.notifyDashboard({
        type: "device:disconnected",
        payload: { deviceId, isOnline: false }
      });

      console.log(`Device ${deviceId} successfully disconnected from SignalR`);
    } catch (error) {
      console.error(`Error handling device disconnect for ${deviceId}:`, error);
    }
  }

  // Handle dashboard connection events - serverless compatible
  public async handleDashboardConnect(connectionId: string, userId?: string): Promise<void> {
    try {
      console.log(`Dashboard connecting to SignalR`, { connectionId, userId });
      
      // In userId mode, no group management needed
      console.log(`Dashboard connected - no group management needed in userId mode`);
      
      // Send current device statuses
      const devices = await prisma.kioskDevice.findMany({
        select: {
          id: true,
          mode: true,
          lastSeenAt: true,
          currentLockId: true
        }
      });

      for (const device of devices) {
        // In serverless, we check connection status differently
        const isOnline = await signalRClient.isDeviceConnected(device.id);
        const isBusy = device.currentLockId !== null;
        
        await signalRClient.notifyDashboard({
          type: "device:status",
          payload: {
            deviceId: device.id,
            isOnline,
            isBusy,
            mode: device.mode,
            lastSeen: device.lastSeenAt
          }
        });
      }

      console.log(`Dashboard successfully connected via SignalR`);
    } catch (error) {
      console.error(`Error handling dashboard connect:`, error);
    }
  }

  // Handle dashboard disconnection events - serverless compatible
  public async handleDashboardDisconnect(connectionId: string): Promise<void> {
    try {
      console.log(`Dashboard disconnecting from SignalR`, { connectionId });
      
      // In userId mode, no group management needed
      console.log(`Dashboard disconnected - no group management needed in userId mode`);
      
      console.log(`Dashboard successfully disconnected from SignalR`);
    } catch (error) {
      console.error(`Error handling dashboard disconnect:`, error);
    }
  }

  // Handle device messages - serverless compatible
  public async handleDeviceMessage(deviceId: string, message: DeviceToServer): Promise<void> {
    try {
      console.log(`Received message from device ${deviceId}:`, message.type);
      
      // Update device last seen in database
      await prisma.kioskDevice.update({
        where: { id: deviceId },
        data: { lastSeenAt: new Date() }
      });
      
      switch (message.type) {
        case 'DELIVERED':
          await this.handleDelivered(deviceId, message.payload);
          break;
        case 'LEASE':
          await this.handleLease(deviceId, message.payload);
          break;
        case 'STATUS':
          await this.handleStatus(deviceId);
          break;
        case 'FEEDBACK_UPDATE':
          await this.handleFeedbackUpdate(deviceId, message.payload);
          break;
        case 'FEEDBACK_CANCELLED':
          await this.handleFeedbackCancelled(deviceId, message.payload);
          break;
        default:
          console.warn(`Unknown message type from device ${deviceId}:`, (message as any).type);
      }
    } catch (error) {
      console.error(`Error handling device message from ${deviceId}:`, error);
    }
  }

  // Message handlers
  private async handleDelivered(deviceId: string, payload: { sessionId: string }): Promise<void> {
    console.log(`Feedback delivered on device ${deviceId}, session ${payload.sessionId}`);
    
    try {
      await prisma.feedbackSession.update({
        where: { id: payload.sessionId },
        data: { 
          status: 'DELIVERED',
          deliveredAt: new Date()
        }
      });
    } catch (error) {
      console.error(`Error marking session ${payload.sessionId} as delivered:`, error);
    }
  }

  private async handleLease(deviceId: string, payload: { deviceId: string }): Promise<void> {
    console.log(`Device lease request from ${deviceId}`, payload);
    // This would be similar to the websocket lease logic
    // Implementation depends on your lease management system
  }

  private async handleStatus(deviceId: string): Promise<void> {
    console.log(`Status request from device ${deviceId}`);
    
    try {
      const device = await prisma.kioskDevice.findUnique({
        where: { id: deviceId },
        include: {
          currentLock: {
            include: {
              case: true
            }
          }
        }
      });

      if (device && device.currentLock) {
        // Send current lock information
        await signalRClient.assignLockToDevice(deviceId, {
          lockId: device.currentLock.id,
          caseId: device.currentLock.caseId,
          case: device.currentLock.case
        });
      }
    } catch (error) {
      console.error(`Error handling status request from device ${deviceId}:`, error);
    }
  }

  private async handleFeedbackUpdate(deviceId: string, payload?: any): Promise<void> {
    console.log(`Feedback update from device ${deviceId}`, payload);
    // Handle feedback form updates
  }

  private async handleFeedbackCancelled(deviceId: string, payload: { sessionId: string }): Promise<void> {
    console.log(`Feedback cancelled on device ${deviceId}, session ${payload.sessionId}`);
    
    try {
      const session = await prisma.feedbackSession.findUnique({
        where: { id: payload.sessionId },
        select: { id: true, status: true, caseId: true, deviceId: true }
      });
      
      if (!session) {
        console.log(`Session ${payload.sessionId} not found`);
        return;
      }
      
      if (session.deviceId !== deviceId) {
        console.log(`Session ${payload.sessionId} does not belong to device ${deviceId}`);
        return;
      }
      
      // Only cancel if session is still active
      if (session.status === 'CREATED' || session.status === 'DELIVERED') {
        await prisma.$transaction(async (tx) => {
          // Cancel the feedback session
          await tx.feedbackSession.update({
            where: { id: payload.sessionId },
            data: { status: 'CANCELLED' }
          });
          
          // Find and complete any associated lock
          const associatedLock = await tx.kioskLock.findFirst({
            where: {
              deviceId: deviceId,
              caseId: session.caseId,
              status: 'ACTIVE'
            }
          });
          
          if (associatedLock) {
            // Complete the lock
            await tx.kioskLock.update({
              where: { id: associatedLock.id },
              data: { 
                status: 'COMPLETED',
                releasedAt: new Date(),
                version: { increment: 1 }
              }
            });
            
            // Release the device
            await tx.kioskDevice.update({
              where: { id: deviceId },
              data: { currentLockId: null }
            });
          }
          
          // Resolve case
          await tx.studentCase.update({
            where: { id: session.caseId },
            data: { 
              status: 'RESOLVED',
              resolvedAt: new Date()
            }
          });
        });
        
        console.log(`Successfully cancelled feedback session ${payload.sessionId} and released resources`);
        
        // Get device's actual online status
        const device = await prisma.kioskDevice.findUnique({
          where: { id: deviceId },
          select: { isConnected: true, lastSeenAt: true }
        });
        
        const isOnline = device?.isConnected || false;
        
        // Notify dashboard clients
        await signalRClient.notifyDashboard({
          type: "case:updated",
          payload: { id: session.caseId, status: "RESOLVED" }
        });
        
        await signalRClient.notifyDashboard({
          type: "device:updated", 
          payload: { id: deviceId, isBusy: false, isOnline }
        });
      } else {
        console.log(`Session ${payload.sessionId} is not in an active state (${session.status}), no action needed`);
      }
    } catch (error) {
      console.error(`Error handling feedback cancellation for session ${payload.sessionId}:`, error);
    }
  }
}

// Singleton instance
export const signalREventHandler = new SignalREventHandler();
