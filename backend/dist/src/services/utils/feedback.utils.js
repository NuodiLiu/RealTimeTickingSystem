"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadBasics = loadBasics;
exports.assertModeAllowsFeedback = assertModeAllowsFeedback;
exports.assertOnline = assertOnline;
exports.findActiveLock = findActiveLock;
exports.throwBusy = throwBusy;
exports.computeTimes = computeTimes;
exports.createSessionTx = createSessionTx;
exports.createLockTx = createLockTx;
exports.casBindCurrentLock = casBindCurrentLock;
exports.markCasePendingIfNeeded = markCasePendingIfNeeded;
exports.preconditionFailed = preconditionFailed;
exports.clearDevicePointerToLock = clearDevicePointerToLock;
exports.overrideOldLockTx = overrideOldLockTx;
exports.overrideActiveSessionsOnDevice = overrideActiveSessionsOnDevice;
exports.resolveOriginalCase = resolveOriginalCase;
const error_1 = require("../../error");
const feedback_constants_1 = require("./feedback.constants");
// read case/device/staff  (for validation and response)
async function loadBasics(db, args) {
    const [scase, device, staff] = await Promise.all([
        db.studentCase.findUnique({ where: { id: args.caseId } }),
        db.kioskDevice.findUnique({ where: { id: args.deviceId } }),
        db.staff.findUnique({ where: { id: args.staffId }, select: { id: true, name: true } }),
    ]);
    if (!scase)
        throw new error_1.NotFoundError("Case not found");
    if (!device)
        throw new error_1.NotFoundError("Device not found");
    if (!staff)
        throw new error_1.NotFoundError("Staff not found");
    return { scase, device, staff };
}
// device mode must allow feedback
function assertModeAllowsFeedback(mode) {
    if (mode === "REGISTRATION") {
        throw new error_1.ForbiddenError("Device mode does not allow feedback");
    }
}
// last seen at + tolerance window 
function assertOnline(lastSeenAt) {
    const online = Date.now() - new Date(lastSeenAt).getTime() <= feedback_constants_1.ONLINE_GRACE_MS;
    if (!online) {
        const err = new error_1.ConflictError("Device offline");
        err.code = "offline";
        throw err;
    }
}
// find active lock 
async function findActiveLock(db, deviceId) {
    return db.kioskLock.findFirst({
        where: { deviceId, status: "ACTIVE", leaseExpireAt: { gt: new Date() } },
        include: {
            staff: { select: { id: true, name: true } },
            case: { select: { id: true, studentName: true } },
        },
    });
}
// throw busy error with lock info
function throwBusy(lock) {
    const err = new error_1.ConflictError("Device busy");
    err.code = "busy";
    err.busy = {
        lockId: lock.id,
        version: lock.version,
        caseId: lock.caseId,
        studentName: lock.case.studentName,
        staffName: lock.staff.name || 'Unknown Staff',
    };
    throw err;
}
// generate timestamp
function computeTimes(now = new Date()) {
    return {
        now,
        leaseExpireAt: new Date(now.getTime() + feedback_constants_1.LOCK_LEASE_SECONDS * 1000),
        sessionExpireAt: new Date(now.getTime() + feedback_constants_1.SESSION_EXPIRE_MINUTES * 60000),
    };
}
// create feedback session
function createSessionTx(db, args) {
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
function createLockTx(db, args) {
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
async function casBindCurrentLock(db, deviceId, lockId, codeWhenFail = "busy") {
    const updated = await db.kioskDevice.updateMany({
        where: { id: deviceId, currentLockId: null },
        data: { currentLockId: lockId },
    });
    if (updated.count !== 1) {
        const err = new error_1.ConflictError(codeWhenFail === "busy" ? "Device just became busy" : "Precondition failed");
        err.code = codeWhenFail;
        throw err;
    }
}
// set case to resolved_pending_feedback (if not already resolved)
async function markCasePendingIfNeeded(db, caseId, currentStatus) {
    if (currentStatus !== "RESOLVED") {
        await db.studentCase.update({
            where: { id: caseId },
            data: { status: "RESOLVED_PENDING_FEEDBACK" },
        });
    }
}
// precondition failed error with lock info
function preconditionFailed(current) {
    const err = new error_1.ConflictError("Precondition failed");
    err.code = "precondition_failed";
    err.current = {
        lockId: current.id,
        version: current.version,
        caseId: current.caseId,
        studentName: current.case.studentName,
        staffName: current.staff.name || 'Unknown Staff',
    };
    throw err;
}
// overwrite: clear device.currentLockId if it points to expectedLockId
async function clearDevicePointerToLock(db, deviceId, expectedLockId) {
    const cleared = await db.kioskDevice.updateMany({
        where: { id: deviceId, currentLockId: expectedLockId },
        data: { currentLockId: null },
    });
    if (cleared.count !== 1) {
        const err = new error_1.ConflictError("Precondition failed (device pointer changed)");
        err.code = "precondition_failed";
        throw err;
    }
}
// mark old lock as overriden
async function overrideOldLockTx(db, lockId, expectedVersion, now = new Date()) {
    const upd = await db.kioskLock.updateMany({
        where: { id: lockId, status: "ACTIVE", version: expectedVersion },
        data: { status: "OVERRIDDEN", releasedAt: now, version: expectedVersion + 1 },
    });
    if (upd.count !== 1) {
        const err = new error_1.ConflictError("Precondition failed (lock changed)");
        err.code = "precondition_failed";
        throw err;
    }
}
// active sessions still in create/delivered status
function overrideActiveSessionsOnDevice(db, deviceId, staffId, now = new Date()) {
    return db.feedbackSession.updateMany({
        where: { deviceId, status: { in: ["CREATED", "DELIVERED"] } },
        data: { status: "OVERRIDDEN", overriddenAt: now },
    });
}
// resolve original case (if not already resolved)
async function resolveOriginalCase(db, caseId, now = new Date()) {
    return db.studentCase.update({
        where: { id: caseId },
        data: {
            status: "RESOLVED",
            resolvedAt: now
        },
    });
}
//# sourceMappingURL=feedback.utils.js.map