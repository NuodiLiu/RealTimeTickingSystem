import type { Server } from "socket.io";
import type { DeviceToServer, AuthedDevice, ServerToDevice } from "./types";
import { verifySocketHandshake } from "./auth";
import { prisma } from "../lib/prisma";
import { addLeaseSeconds } from "./lease";

// Type for socket data
type SocketData = {
  type: 'device' | 'dashboard';
  deviceId?: string;
  mode?: string;
  userId?: string;
};

// origin url white list
function checkOrigin(origin?: string): boolean {
  // Always allow in development
  if (process.env.NODE_ENV === 'development') return true;
  
  // Always allow in test
  if (process.env.NODE_ENV === 'test') return true;
  
  // Allow no origin (mobile apps, Postman, etc.)
  if (!origin) return true;
  
  // Allow common mobile app origins
  const mobileOrigins = [
    'capacitor://localhost',
    'ionic://localhost',
    'file://',
  ];
  
  if (mobileOrigins.some(allowed => origin.startsWith(allowed))) {
    return true;
  }
  
  // Allow configured frontend URL
  const allowed = process.env.FRONTEND_URL;
  return !allowed || origin.startsWith(allowed);
}

export function bindRealtime(io: Server) {
  // 底层心跳（配合 socket.io 自带心跳），增强鲁棒性
  io.engine.on("connection_error", (err) => {
    // 可加日志
  });

  io.use(async (socket, next) => {
    try {
      if (!checkOrigin(socket.request.headers.origin)) return next(new Error("Origin not allowed"));
      const connectionInfo = await verifySocketHandshake(socket);
      (socket.data as SocketData) = connectionInfo;
      next();
    } catch (e) {
      next(e as any);
    }
  });

  io.on("connection", async (socket) => {
    const connectionInfo = socket.data as SocketData;
    
    // Handle dashboard connections
    if (connectionInfo.type === 'dashboard') {
      console.log('Dashboard connected');
      
      socket.on("disconnect", () => {
        console.log('Dashboard disconnected');
      });
      
      return; // Dashboard connections don't need device-specific logic
    }
    
    // Handle device connections
    const { deviceId, mode } = connectionInfo;
    if (!deviceId || !mode) {
      socket.disconnect();
      return;
    }
    
    const room = `device:${deviceId}`;

    // disconnect previous connection if there are any
    const existingSockets = await io.in(room).fetchSockets();
    for (const s of existingSockets) {
      if (s.id !== socket.id) {
        s.disconnect(true);
      }
    }

    await socket.join(room);

    // 设备上线：刷新 lastSeenAt（吸收你 ws 版）
    await prisma.kioskDevice.update({ where: { id: deviceId }, data: { lastSeenAt: new Date() } });

    // 发送一次 PING，设备可立即 PONG
    socket.emit("message", { type: "PING", payload: { now: new Date().toISOString() } } as ServerToDevice);

    // 多连接：Socket.IO 的 room 天然支持“同设备多连接”——无需你自己维护 Map/Set
    socket.on("disconnect", async () => {
      clearInterval(timer);
      console.log(`Device ${deviceId} disconnected.`);

      try {
        const device = await prisma.kioskDevice.findUnique({
          where: { id: deviceId },
          include: {
            currentLock: true
          }
        });

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
              data: { currentLockId: null },
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
          
          // Notify dashboard clients
          io.emit("event", { type: "case:updated", payload: { id: caseId, status: "RESOLVED" } });
          io.emit("event", { type: "device:updated", payload: { id: deviceId, isBusy: false } });
        }
      } catch (error) {
        console.error(`Error during disconnect cleanup for device ${deviceId}:`, error);
      }
    });

    socket.on("message", async (raw: unknown) => {
      try {
        // 1) 只接受 object 且有 string 类型的 "type" 字段
        const msg = (raw && typeof raw === "object") ? (raw as any) : undefined;
        const type = (msg && typeof msg.type === "string") ? (msg.type as string) : undefined;

        switch (type) {
          case "PONG": {
            await prisma.kioskDevice.update({
              where: { id: deviceId },
              data: { lastSeenAt: new Date() },
            });
            break;
          }
          case "LEASE": {
            await addLeaseSeconds(deviceId, 30);
            break;
          }
          case "STATUS": {
            await prisma.kioskDevice.update({
              where: { id: deviceId },
              data: { lastSeenAt: new Date() },
            });
            break;
          }
          case "DELIVERED": {
            const sid = msg?.payload?.sessionId;
            if (typeof sid === "string" && sid) {
              await prisma.feedbackSession.updateMany({
                where: { id: sid, deviceId, status: "CREATED" },
                data: { status: "DELIVERED", deliveredAt: new Date() },
              });
            }
            break;
          }
          case "FEEDBACK_UPDATE": {
            // ignore or audit
            break;
          }
          default: {
            // unknown type -- should ignore and no throw
            return;
          }
        }
      } catch (e) {
        // logger.warn?.("ws message handling error", e);
      }
    });

    // —— 服务器侧定时 PING（增强稳态；Socket.IO 自带心跳，但我们保留业务 PING）——
    const timer = setInterval(() => {
      if (socket.connected) {
        socket.emit("message", { type: "PING", payload: { now: new Date().toISOString() } } as ServerToDevice);
      } else {
        clearInterval(timer);
      }
    }, 15_000);
  });
}
