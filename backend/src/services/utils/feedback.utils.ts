import { prisma } from "../../lib/prisma";
// 如果你的类型来自自定义输出路径，改成下面这一行
// import type { Prisma } from "../generated/prisma";
import type { Prisma } from "@prisma/client";

import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../error";
import {
  ONLINE_GRACE_MS,
  LOCK_LEASE_SECONDS,
  SESSION_EXPIRE_MINUTES,
} from "./feedback.constants";

// 让 tx 与 prisma 共用同一组函数
export type DB = Prisma.TransactionClient | typeof prisma;

/** 读取 case/device/staff，统一 404 处理 */
export async function loadBasics(db: DB, args: {
  caseId: string; deviceId: string; staffId: string;
}) {
  const [scase, device, staff] = await Promise.all([
    db.studentCase.findUnique({ where: { id: args.caseId } }),
    db.kioskDevice.findUnique({ where: { id: args.deviceId } }),
    db.staff.findUnique({ where: { id: args.staffId }, select: { id: true, name: true } }),
  ]);
  if (!scase) throw new NotFoundError("Case not found");
  if (!device) throw new NotFoundError("Device not found");
  if (!staff) throw new NotFoundError("Staff not found");
  return { scase, device, staff };
}

/** 设备模式必须允许 FEEDBACK */
export function assertModeAllowsFeedback(mode: string) {
  if (mode === "REGISTRATION") {
    throw new ForbiddenError("Device mode does not allow feedback");
  }
}

/** 在线判定（lastSeenAt + 容忍窗口） */
export function assertOnline(lastSeenAt: Date) {
  const online = Date.now() - new Date(lastSeenAt).getTime() <= ONLINE_GRACE_MS;
  if (!online) {
    const err = new ConflictError("Device offline");
    (err as any).code = "offline";
    throw err;
  }
}

/** 查找当前 ACTIVE 锁（含 staff/case 信息，便于报错时返回） */
export async function findActiveLock(db: DB, deviceId: string) {
  return db.kioskLock.findFirst({
    where: { deviceId, status: "ACTIVE", leaseExpireAt: { gt: new Date() } },
    include: {
      staff: { select: { id: true, name: true } },
      case: { select: { id: true, studentName: true } },
    },
  });
}

/** 抛 Busy 错（带详情，给前端 UI 展示） */
export function throwBusy(lock: {
  id: string; version: number; caseId: string;
  staff: { name: string }; case: { studentName: string };
}) {
  const err = new ConflictError("Device busy");
  (err as any).code = "busy";
  (err as any).busy = {
    lockId: lock.id,
    version: lock.version,
    caseId: lock.caseId,
    studentName: lock.case.studentName,
    staffName: lock.staff.name,
  };
  throw err;
}

/** 生成锁/会话的时间戳 */
export function computeTimes(now = new Date()) {
  return {
    now,
    leaseExpireAt: new Date(now.getTime() + LOCK_LEASE_SECONDS * 1000),
    sessionExpireAt: new Date(now.getTime() + SESSION_EXPIRE_MINUTES * 60_000),
  };
}

/** 创建 FeedbackSession (CREATED) */
export function createSessionTx(db: DB, args: {
  caseId: string; staffId: string; deviceId: string; expireAt: Date;
}) {
  return db.feedbackSession.create({
    data: {
      caseId: args.caseId,
      staffId: args.staffId,
      deviceId: args.deviceId,
      status: "CREATED",
      expireAt: args.expireAt,
    },
  });
}

/** 创建 KioskLock (ACTIVE, version=1) */
export function createLockTx(db: DB, args: {
  deviceId: string; staffId: string; caseId: string; leaseExpireAt: Date;
}) {
  return db.kioskLock.create({
    data: {
      deviceId: args.deviceId,
      staffId: args.staffId,
      caseId: args.caseId,
      status: "ACTIVE",
      version: 1,
      leaseExpireAt: args.leaseExpireAt,
    },
  });
}

/** CAS 绑定 device.currentLockId（仅当为 null 时成功） */
export async function casBindCurrentLock(db: DB, deviceId: string, lockId: string, codeWhenFail: "busy" | "precondition_failed" = "busy") {
  const updated = await db.kioskDevice.updateMany({
    where: { id: deviceId, currentLockId: null },
    data: { currentLockId: lockId },
  });
  if (updated.count !== 1) {
    const err = new ConflictError(codeWhenFail === "busy" ? "Device just became busy" : "Precondition failed");
    (err as any).code = codeWhenFail;
    throw err;
  }
}

/** 置 Case 为 RESOLVED_PENDING_FEEDBACK（若尚未 RESOLVED） */
export async function markCasePendingIfNeeded(db: DB, caseId: string, currentStatus: string) {
  if (currentStatus !== "RESOLVED") {
    await db.studentCase.update({
      where: { id: caseId },
      data: { status: "RESOLVED_PENDING_FEEDBACK" },
    });
  }
}

/** 覆盖前的“预条件校验”失败错误（412 语义，用 409 + code 表达） */
export function preconditionFailed(current: {
  id: string; version: number; caseId: string; staff: { name: string }; case: { studentName: string };
}) {
  const err = new ConflictError("Precondition failed");
  (err as any).code = "precondition_failed";
  (err as any).current = {
    lockId: current.id,
    version: current.version,
    caseId: current.caseId,
    studentName: current.case.studentName,
    staffName: current.staff.name,
  };
  throw err;
}

/** 覆盖：清空 device 指针（保证指向的就是预期旧锁） */
export async function clearDevicePointerToLock(db: DB, deviceId: string, expectedLockId: string) {
  const cleared = await db.kioskDevice.updateMany({
    where: { id: deviceId, currentLockId: expectedLockId },
    data: { currentLockId: null },
  });
  if (cleared.count !== 1) {
    const err = new ConflictError("Precondition failed (device pointer changed)");
    (err as any).code = "precondition_failed";
    throw err;
  }
}

/** 将旧锁标记为 OVERRIDDEN（要求版本匹配） */
export async function overrideOldLockTx(db: DB, lockId: string, expectedVersion: number, now = new Date()) {
  const upd = await db.kioskLock.updateMany({
    where: { id: lockId, status: "ACTIVE", version: expectedVersion },
    data: { status: "OVERRIDDEN", releasedAt: now, version: expectedVersion + 1 },
  });
  if (upd.count !== 1) {
    const err = new ConflictError("Precondition failed (lock changed)");
    (err as any).code = "precondition_failed";
    throw err;
  }
}

/** 作废设备上仍处于 CREATED/DELIVERED 的活动会话 */
export function overrideActiveSessionsOnDevice(db: DB, deviceId: string, staffId: string, now = new Date()) {
  return db.feedbackSession.updateMany({
    where: { deviceId, status: { in: ["CREATED", "DELIVERED"] } },
    data: { status: "OVERRIDDEN", overriddenAt: now},
  });
}

/** Resolve原始case（当被override时，原case直接resolve，无需feedback） */
export async function resolveOriginalCase(db: DB, caseId: string, now = new Date()) {
  return db.studentCase.update({
    where: { id: caseId },
    data: { 
      status: "RESOLVED",
      resolvedAt: now 
    },
  });
}
