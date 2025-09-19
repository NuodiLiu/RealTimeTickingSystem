"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addLeaseSeconds = addLeaseSeconds;
const prisma_1 = require("../lib/prisma");
async function addLeaseSeconds(deviceId, seconds) {
    const active = await prisma_1.prisma.kioskLock.findFirst({
        where: { deviceId, status: "ACTIVE" },
        select: { id: true, leaseExpireAt: true },
    });
    if (!active)
        return;
    const next = new Date(Math.max(Date.now(), active.leaseExpireAt.getTime()) + seconds * 1000);
    await prisma_1.prisma.kioskLock.update({
        where: { id: active.id },
        data: { leaseExpireAt: next, version: { increment: 1 } },
    });
}
//# sourceMappingURL=lease.js.map