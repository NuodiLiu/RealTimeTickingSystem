import type { Server } from "socket.io";
import type { DeviceToServer, AuthedDevice, ServerToDevice } from "./types";
import { verifyDeviceHandshake } from "./auth";
import { prisma } from "../lib/prisma";
import { addLeaseSeconds } from "./lease";

// origin url white list
function checkOrigin(origin?: string): boolean {
  if (!origin) return true;
  if (process.env.NODE_ENV === 'test') return true;
  
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
      const { deviceId, mode } = await verifyDeviceHandshake(socket);
      (socket.data as AuthedDevice) = { deviceId, mode: mode as any };
      next();
    } catch (e) {
      next(e as any);
    }
  });

  io.on("connection", async (socket) => {
    const { deviceId, mode } = socket.data as AuthedDevice;
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
    socket.on("disconnect", () => {
      clearInterval(timer);
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
