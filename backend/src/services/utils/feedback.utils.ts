import { prisma } from "../../lib/prisma";
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

export type DB = Prisma.TransactionClient | typeof prisma;

// read case/device/staff  (for validation and response)
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

// device mode must allow feedback
export function assertModeAllowsFeedback(mode: string) {
  if (mode === "REGISTRATION") {
    throw new ForbiddenError("Device mode does not allow feedback");
  }
}

// last seen at + tolerance window 
export function assertOnline(lastSeenAt: Date) {
  const online = Date.now() - new Date(lastSeenAt).getTime() <= ONLINE_GRACE_MS;
  if (!online) {
    const err = new ConflictError("Device offline");
    (err as any).code = "offline";
    throw err;
  }
}

// find active lock 
export async function findActiveLock(db: DB, deviceId: string) {
  return db.kioskLock.findFirst({
    where: { deviceId, status: "ACTIVE", leaseExpireAt: { gt: new Date() } },
    include: {
      staff: { select: { id: true, name: true } },
      case: { select: { id: true, studentName: true } },
    },
  });
}

// throw busy error with lock info
export function throwBusy(lock: {
  id: string; version: number; caseId: string;
  staff: { name: string | null }; case: { studentName: string };
}) {
  const err = new ConflictError("Device busy");
  (err as any).code = "busy";
  (err as any).busy = {
    lockId: lock.id,
    version: lock.version,
    caseId: lock.caseId,
    studentName: lock.case.studentName,
    staffName: lock.staff.name || 'Unknown Staff',
  };
  throw err;
}

// generate timestamp
export function computeTimes(now = new Date()) {
  return {
    now,
    leaseExpireAt: new Date(now.getTime() + LOCK_LEASE_SECONDS * 1000),
    sessionExpireAt: new Date(now.getTime() + SESSION_EXPIRE_MINUTES * 60_000),
  };
}

// create feedback session
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

// create kiosk lock
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

// binding device.currentLockId to new lock (if not busy)
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

// set case to resolved_pending_feedback (if not already resolved)
export async function markCasePendingIfNeeded(db: DB, caseId: string, currentStatus: string) {
  if (currentStatus !== "RESOLVED") {
    await db.studentCase.update({
      where: { id: caseId },
      data: { status: "RESOLVED_PENDING_FEEDBACK" },
    });
  }
}

// precondition failed error with lock info
export function preconditionFailed(current: {
  id: string; version: number; caseId: string; staff: { name: string | null }; case: { studentName: string };
}) {
  const err = new ConflictError("Precondition failed");
  (err as any).code = "precondition_failed";
  (err as any).current = {
    lockId: current.id,
    version: current.version,
    caseId: current.caseId,
    studentName: current.case.studentName,
    staffName: current.staff.name || 'Unknown Staff',
  };
  throw err;
}

// overwrite: clear device.currentLockId if it points to expectedLockId
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

// mark old lock as overriden
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

// active sessions still in create/delivered status
export function overrideActiveSessionsOnDevice(db: DB, deviceId: string, staffId: string, now = new Date()) {
  return db.feedbackSession.updateMany({
    where: { deviceId, status: { in: ["CREATED", "DELIVERED"] } },
    data: { status: "OVERRIDDEN", overriddenAt: now},
  });
}

// resolve original case (if not already resolved)
export async function resolveOriginalCase(db: DB, caseId: string, now = new Date()) {
  return db.studentCase.update({
    where: { id: caseId },
    data: { 
      status: "RESOLVED",
      resolvedAt: now 
    },
  });
}
