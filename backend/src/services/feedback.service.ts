import { prisma } from "../lib/prisma";
import type { Prisma } from "@prisma/client";

import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "../error";

import {
  loadBasics, assertModeAllowsFeedback, assertOnline, findActiveLock, throwBusy,
  computeTimes, createSessionTx, createLockTx, casBindCurrentLock, markCasePendingIfNeeded,
  preconditionFailed, clearDevicePointerToLock, overrideOldLockTx, overrideActiveSessionsOnDevice,
  resolveOriginalCase,
} from "./utils/feedback.utils";
import { DeviceGateway } from "../websocket/deviceSocket";

export type SendFeedbackArgs = { caseId: string; deviceId: string; staffId: string };
export type OverrideFeedbackArgs = {
  caseId: string; deviceId: string; staffId: string;
  expectedLockId: string; expectedVersion: number;
};
export type SubmitFeedbackArgs = { sessionId: string; rating: number; comment: string; };

export class FeedbackService {
  static async sendFeedback({ caseId, deviceId, staffId }: SendFeedbackArgs) {
    if (!caseId || !deviceId || !staffId) {
      throw new BadRequestError("caseId, deviceId, staffId are required");
    }

    // read and validate
    const { scase, device, staff } = await loadBasics(prisma, { caseId, deviceId, staffId });
    assertModeAllowsFeedback(device.mode);
    assertOnline(device.lastSeenAt);

    // Busy/Idle Check
    const activeLock = await findActiveLock(prisma, deviceId);
    if (activeLock) throwBusy(activeLock);

    // check if other devices are processing this case
    const existingActiveFeedback = await prisma.feedbackSession.findFirst({
      where: {
        caseId,
        status: { in: ['CREATED', 'DELIVERED'] },
        deviceId: { not: deviceId }
      },
      select: {
        id: true,
        deviceId: true,
        device: {
          select: { name: true }
        }
      }
    });

    if (existingActiveFeedback) {
      const err = new ConflictError(`This case already has an active feedback session on device "${existingActiveFeedback.device.name}"`);
      (err as any).code = "feedback_in_progress";
      throw err;
    }

    // create session + lock + binding + pending feedback
    const { now, leaseExpireAt, sessionExpireAt } = computeTimes();
    const { session, lock } = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const d = await tx.kioskDevice.findUnique({ where: { id: deviceId }, select: { id: true, mode: true } });
        if (!d) throw new NotFoundError("Device not found");
        assertModeAllowsFeedback(d.mode);

        const session = await createSessionTx(tx, { caseId, staffId, deviceId, expireAt: sessionExpireAt });
        const lock = await createLockTx(tx, { deviceId, staffId, caseId, leaseExpireAt });
        await casBindCurrentLock(tx, deviceId, lock.id, "busy");
        await markCasePendingIfNeeded(tx, caseId, scase.status);

        return { session, lock };
      }
    );

    // push to device
    DeviceGateway.publish(deviceId, {
      type: "SHOW_FEEDBACK",
      payload: {
        sessionId: session.id,
        caseId,
        staff: { id: staff.id, name: staff.name },
        expireAt: sessionExpireAt.toISOString(),
      },
    });

    // notify dashboard device is now busy
    DeviceGateway.notifyDashboard({
      type: "device:updated",
      payload: { id: deviceId, isBusy: true, isOnline: true }
    });

    return {
      session: { id: session.id, status: "CREATED", deviceId, caseId, expireAt: sessionExpireAt },
      lock: { id: lock.id, status: "ACTIVE", version: lock.version, leaseExpireAt },
      case: { id: scase.id, status: scase.status === "RESOLVED" ? "RESOLVED" : "RESOLVED_PENDING_FEEDBACK" },
    };
  }

  static async overrideFeedback({
    caseId, deviceId, staffId, expectedLockId, expectedVersion,
  }: OverrideFeedbackArgs) {
    if (!caseId || !deviceId || !staffId || !expectedLockId || expectedVersion == null) {
      throw new BadRequestError("caseId, deviceId, staffId, expectedLockId, expectedVersion are required");
    }

    const { scase, device, staff } = await loadBasics(prisma, { caseId, deviceId, staffId });
    assertModeAllowsFeedback(device.mode);
    assertOnline(device.lastSeenAt);

    const currentLock = await findActiveLock(prisma, deviceId);
    if (!currentLock) {
      const err = new ConflictError("Device is not busy");
      (err as any).code = "idle";
      throw err;
    }
    if (currentLock.id !== expectedLockId || currentLock.version !== expectedVersion) {
      preconditionFailed(currentLock);
    }

    // override old lock and session, create new lock + session, bind, pending feedback
    const { now, leaseExpireAt, sessionExpireAt } = computeTimes();
    const { newSession, newLock } = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const d = await tx.kioskDevice.findUnique({ where: { id: deviceId }, select: { id: true, mode: true } });
        if (!d) throw new NotFoundError("Device not found");
        assertModeAllowsFeedback(d.mode);

        await clearDevicePointerToLock(tx, deviceId, expectedLockId);
        await overrideOldLockTx(tx, expectedLockId, expectedVersion, now);
        await overrideActiveSessionsOnDevice(tx, deviceId, staffId, now);
        
        // Resolve原始case（被override的case直接resolve，无需feedback）
        await resolveOriginalCase(tx, currentLock.caseId, now);

        const newSession = await createSessionTx(tx, { caseId, staffId, deviceId, expireAt: sessionExpireAt });
        const newLock = await createLockTx(tx, { deviceId, staffId, caseId, leaseExpireAt });
        await casBindCurrentLock(tx, deviceId, newLock.id, "precondition_failed");
        await markCasePendingIfNeeded(tx, caseId, scase.status);

        return { newSession, newLock };
      }
    );

    // replace feedback request on device
    DeviceGateway.publish(deviceId, { type: "DISMISS" });
    
    // show feedback 
    DeviceGateway.publish(deviceId, {
      type: "SHOW_FEEDBACK",
      payload: {
        sessionId: newSession.id,
        caseId,
        staff: { id: staff.id, name: staff.name },
        expireAt: sessionExpireAt.toISOString(),
      },
    });

    // device is busy with new case
    DeviceGateway.notifyDashboard({
      type: "device:updated",
      payload: { 
        id: deviceId, 
        isBusy: true,
        isOnline: true,
        currentCaseId: caseId, 
        overriddenCaseId: currentLock.caseId
      }
    });

    return {
      previous: { 
        lockId: expectedLockId, 
        status: "OVERRIDDEN" as const,
        caseId: currentLock.caseId,
        caseStatus: "RESOLVED" as const
      },
      session: { id: newSession.id, status: "CREATED" as const, deviceId, caseId, expireAt: sessionExpireAt },
      lock: { id: newLock.id, status: "ACTIVE" as const, version: newLock.version, leaseExpireAt },
    };
  }

  static async submitFeedback({ sessionId, rating, comment }: SubmitFeedbackArgs) {
    if (!sessionId || rating == null) {
      throw new BadRequestError("sessionId and rating are required");
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new BadRequestError("rating must be an integer in [1..5]");
    }

    const session = await prisma.feedbackSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true, status: true, caseId: true, deviceId: true, staffId: true,
      },
    });
    if (!session) throw new NotFoundError("Feedback session not found");

    // session must be active
    if (session.status === "OVERRIDDEN" || session.status === "CANCELLED" || session.status === "EXPIRED") {
      const err = new ConflictError("Session inactive");
      (err as any).code = "session_inactive";
      throw err;
    }
    if (session.status === "SUBMITTED") {
      const existing = await prisma.feedback.findUnique({ where: { caseId: session.caseId } });
      return {
        feedback: existing ? { id: existing.id, caseId: existing.caseId, rating: existing.rating, comment: existing.comment } : null,
        session: { id: session.id, status: "SUBMITTED" as const },
      };
    }

    const now = new Date();
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      let feedbackId: string | null = null;
      try {
        const created = await tx.feedback.create({
          data: {
            caseId: session.caseId,
            staffId: session.staffId, 
            rating,
            comment,
          },
          select: { id: true },
        });
        feedbackId = created.id;
      } catch (e: any) {
        if (e?.code !== "P2002") throw e;
      }

      // sesssion submitted
      await tx.feedbackSession.update({
        where: { id: session.id },
        data: { status: "SUBMITTED", submittedAt: now },
      });

      // lock completed
      const activeLock = await tx.kioskLock.findFirst({
        where: { deviceId: session.deviceId, caseId: session.caseId, status: "ACTIVE" },
        select: { id: true },
      });
      if (activeLock) {
        await tx.kioskLock.updateMany({
          where: { id: activeLock.id, status: "ACTIVE" },
          data: { status: "COMPLETED", releasedAt: now, version: { increment: 1 } },
        });
        await tx.kioskDevice.updateMany({
          where: { id: session.deviceId, currentLockId: activeLock.id },
          data: { currentLockId: null },
        });
      }

      // case resolved
      await tx.studentCase.update({
        where: { id: session.caseId },
        data: { status: "RESOLVED", resolvedAt: now },
      });

      return { feedbackId };
    });

    // nogtify device, if submission successful, go back to idle
    DeviceGateway.publish(session.deviceId, {
      type: "DISMISS",
    });

    // device idle again after notifying dashboard
    DeviceGateway.notifyDashboard({
      type: "case:updated",
      payload: { id: session.caseId, status: "RESOLVED" }
    });
    DeviceGateway.notifyDashboard({
      type: "device:updated", 
      payload: { id: session.deviceId, isBusy: false, isOnline: true }
    });

    return {
      feedback: result.feedbackId ? { id: result.feedbackId, caseId: session.caseId, rating, comment } : null,
      session: { id: session.id, status: "SUBMITTED" as const },
    };
  }
}
