import { prisma } from "../lib/prisma";

export async function addLeaseSeconds(deviceId: string, seconds: number) {
  const active = await prisma.kioskLock.findFirst({
    where: { deviceId, status: "ACTIVE" },
    select: { id: true, leaseExpireAt: true },
  });
  if (!active) return;
  const next = new Date(Math.max(Date.now(), active.leaseExpireAt.getTime()) + seconds * 1000);
  await prisma.kioskLock.update({
    where: { id: active.id },
    data: { leaseExpireAt: next, version: { increment: 1 } },
  });
}
