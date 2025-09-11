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

    // 1) 读取并校验（非事务）
    const { scase, device, staff } = await loadBasics(prisma, { caseId, deviceId, staffId });
    assertModeAllowsFeedback(device.mode);
    assertOnline(device.lastSeenAt);

    // 2) 忙闲判断
    const activeLock = await findActiveLock(prisma, deviceId);
    if (activeLock) throwBusy(activeLock);

    // 3) 事务：创建 session + 锁 + CAS 绑定 + 置 case 等待反馈
    const { now, leaseExpireAt, sessionExpireAt } = computeTimes();
    const { session, lock } = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        // 再次校验 mode
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

    // 4) 推送设备
    DeviceGateway.publish(deviceId, {
      type: "SHOW_FEEDBACK",
      payload: {
        sessionId: session.id,
        caseId,
        staff: { id: staff.id, name: staff.name },
        expireAt: sessionExpireAt.toISOString(),
      },
    });

    // 5) 通知portal/dashboard：设备现在忙碌
    DeviceGateway.notifyDashboard({
      type: "device:updated",
      payload: { id: deviceId, isBusy: true }
    });

    // 6) 返回
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

    // 1) 读取并校验
    const { scase, device, staff } = await loadBasics(prisma, { caseId, deviceId, staffId });
    assertModeAllowsFeedback(device.mode);
    assertOnline(device.lastSeenAt);

    // 2) 必须存在 ACTIVE 锁，且与预期匹配
    const currentLock = await findActiveLock(prisma, deviceId);
    if (!currentLock) {
      const err = new ConflictError("Device is not busy");
      (err as any).code = "idle";
      throw err;
    }
    if (currentLock.id !== expectedLockId || currentLock.version !== expectedVersion) {
      preconditionFailed(currentLock);
    }

    // 3) 事务：清指针 → 旧锁 OVERRIDDEN → 作废旧会话 → 新会话/新锁 → CAS 绑定 → 置 case 等待反馈
    const { now, leaseExpireAt, sessionExpireAt } = computeTimes();
    const { newSession, newLock } = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const d = await tx.kioskDevice.findUnique({ where: { id: deviceId }, select: { id: true, mode: true } });
        if (!d) throw new NotFoundError("Device not found");
        assertModeAllowsFeedback(d.mode);

        await clearDevicePointerToLock(tx, deviceId, expectedLockId);
        await overrideOldLockTx(tx, expectedLockId, expectedVersion, now);
        await overrideActiveSessionsOnDevice(tx, deviceId, staffId, now);

        const newSession = await createSessionTx(tx, { caseId, staffId, deviceId, expireAt: sessionExpireAt });
        const newLock = await createLockTx(tx, { deviceId, staffId, caseId, leaseExpireAt });
        await casBindCurrentLock(tx, deviceId, newLock.id, "precondition_failed");
        await markCasePendingIfNeeded(tx, caseId, scase.status);

        return { newSession, newLock };
      }
    );

    // 4) 推送：先 DISMISS，再 SHOW_FEEDBACK
    DeviceGateway.publish(deviceId, { type: "DISMISS"});
    DeviceGateway.publish(deviceId, {
      type: "SHOW_FEEDBACK",
      payload: {
        sessionId: newSession.id,
        caseId,
        staff: { id: staff.id, name: staff.name },
        expireAt: sessionExpireAt.toISOString(),
      },
    });

    return {
      previous: { lockId: expectedLockId, status: "OVERRIDDEN" as const },
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

    // 0) 读会话
    const session = await prisma.feedbackSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true, status: true, caseId: true, deviceId: true, staffId: true,
      },
    });
    if (!session) throw new NotFoundError("Feedback session not found");

    // 会话必须是活动态
    if (session.status === "OVERRIDDEN" || session.status === "CANCELLED" || session.status === "EXPIRED") {
      const err = new ConflictError("Session inactive");
      (err as any).code = "session_inactive";
      throw err;
    }
    // 若已提交则幂等成功返回（读已有反馈）
    if (session.status === "SUBMITTED") {
      const existing = await prisma.feedback.findUnique({ where: { caseId: session.caseId } });
      return {
        feedback: existing ? { id: existing.id, caseId: existing.caseId, rating: existing.rating, comment: existing.comment } : null,
        session: { id: session.id, status: "SUBMITTED" as const },
      };
    }

    // 1~5) 事务内原子更新
    const now = new Date();
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1) Feedback 写入（幂等：若已存在则当作成功）
      let feedbackId: string | null = null;
      try {
        const created = await tx.feedback.create({
          data: {
            caseId: session.caseId,
            staffId: session.staffId, // 归属处理此 case 的 staff
            rating,
            comment,
          },
          select: { id: true },
        });
        feedbackId = created.id;
      } catch (e: any) {
        // P2002: unique constraint (`caseId`) 冲突，说明已经提交过；视为幂等成功
        if (e?.code !== "P2002") throw e;
      }

      // 2) Session → SUBMITTED
      await tx.feedbackSession.update({
        where: { id: session.id },
        data: { status: "SUBMITTED", submittedAt: now },
      });

      // 3) 锁 → COMPLETED（找到这台设备、这个 case 的 ACTIVE 锁并完成它）
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

      // 4) Case → RESOLVED
      await tx.studentCase.update({
        where: { id: session.caseId },
        data: { status: "RESOLVED", resolvedAt: now },
      });

      return { feedbackId };
    });

    // 6) 通知设备端：提交成功，可以回到空闲状态
    DeviceGateway.publish(session.deviceId, {
      type: "DISMISS", // 或者可以用其他消息类型
    });

    // 7) 通知portal/dashboard：案例已解决，设备已空闲
    DeviceGateway.notifyDashboard({
      type: "case:updated",
      payload: { id: session.caseId, status: "RESOLVED" }
    });
    DeviceGateway.notifyDashboard({
      type: "device:updated", 
      payload: { id: session.deviceId, isBusy: false }
    });

    return {
      feedback: result.feedbackId ? { id: result.feedbackId, caseId: session.caseId, rating, comment } : null,
      session: { id: session.id, status: "SUBMITTED" as const },
    };
  }
}
