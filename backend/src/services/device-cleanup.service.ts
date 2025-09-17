import { prisma } from "../lib/prisma";

export class DeviceCleanupService {

  // Clean up active locks and sessions when a device disconnects
  static async cleanupDeviceOnDisconnect(deviceId: string) {
    try {
      // Check if this device has any active locks that should be expired
      const activeLock = await prisma.kioskLock.findFirst({
        where: { deviceId, status: "ACTIVE" }
      });

      if (activeLock) {
        console.log(`🧹 Cleaning up device ${deviceId.slice(0, 8)} disconnect - found active lock ${activeLock.id}`);

        // Cancel any active feedback sessions
        await prisma.feedbackSession.updateMany({
          where: { 
            deviceId, 
            status: { in: ["CREATED", "DELIVERED"] } 
          },
          data: { 
            status: "CANCELLED"
          }
        });

        // Mark the lock as completed and clear device pointer
        await prisma.$transaction(async (tx) => {
          await tx.kioskLock.update({
            where: { id: activeLock.id },
            data: { status: "COMPLETED" }
          });
          
          await tx.kioskDevice.update({
            where: { id: deviceId },
            data: { currentLockId: null }
          });

          // If there was a case in RESOLVED_PENDING_FEEDBACK, resolve it
          if (activeLock.caseId) {
            const updatedCase = await tx.studentCase.updateMany({
              where: { 
                id: activeLock.caseId,
                status: "RESOLVED_PENDING_FEEDBACK"
              },
              data: { 
                status: "RESOLVED",
                resolvedAt: new Date()
              }
            });
            
            if (updatedCase.count > 0) {
              console.log(`Auto-resolved case ${activeLock.caseId} due to device disconnect`);
            }
          }
        });

        console.log(`Device ${deviceId.slice(0, 8)} cleanup completed`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`Error cleaning up device ${deviceId} on disconnect:`, error);
      return false;
    }
  }

  // Clean up expired locks and sessions 
  static async cleanupExpiredSessions() {
    try {
      const now = new Date();
      
      // Find expired feedback sessions
      const expiredSessions = await prisma.feedbackSession.findMany({
        where: {
          expireAt: { lt: now },
          status: { in: ["CREATED", "DELIVERED"] }
        }
      });

      for (const session of expiredSessions) {
        await prisma.$transaction(async (tx) => {
          // Cancel the session
          await tx.feedbackSession.update({
            where: { id: session.id },
            data: { status: "EXPIRED" }
          });

          // Find any associated lock for this device
          const associatedLock = await tx.kioskLock.findFirst({
            where: {
              deviceId: session.deviceId,
              status: "ACTIVE"
            }
          });

          if (associatedLock) {
            await tx.kioskLock.update({
              where: { id: associatedLock.id },
              data: { status: "EXPIRED" }
            });

            // Clear device pointer
            await tx.kioskDevice.update({
              where: { id: session.deviceId },
              data: { currentLockId: null }
            });
          }

          // Auto-resolve any pending feedback cases
          if (session.caseId) {
            await tx.studentCase.updateMany({
              where: { 
                id: session.caseId,
                status: "RESOLVED_PENDING_FEEDBACK"
              },
              data: { 
                status: "RESOLVED",
                resolvedAt: now
              }
            });
          }
        });
      }

      if (expiredSessions.length > 0) {
        console.log(`Cleaned up ${expiredSessions.length} expired feedback sessions`);
      }

      return expiredSessions.length;
    } catch (error) {
      console.error("Error cleaning up expired sessions:", error);
      return 0;
    }
  }
}
