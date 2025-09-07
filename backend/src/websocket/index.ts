import type { Server } from "socket.io";
import type { DeviceToServer, AuthedDevice, ServerToDevice } from "./types";
import { verifyDeviceHandshake } from "./auth";
import { prisma } from "../lib/prisma";
import { addLeaseSeconds } from "./lease";

// origin url white list
function checkOrigin(origin?: string): boolean {
  if (!origin) return true;
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

    await socket.join(room);

    // 设备上线：刷新 lastSeenAt（吸收你 ws 版）
    await prisma.kioskDevice.update({ where: { id: deviceId }, data: { lastSeenAt: new Date() } });

    // 发送一次 PING，设备可立即 PONG
    socket.emit("message", { type: "PING", payload: { now: new Date().toISOString() } } as ServerToDevice);

    // 多连接：Socket.IO 的 room 天然支持“同设备多连接”——无需你自己维护 Map/Set

    socket.on("disconnect", () => {
      // 可按需记录
    });

    socket.on("message", async (msg: DeviceToServer) => {
      switch (msg.type) {
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
          // 设备请求当前状态（轻量化：只刷新 lastSeenAt；如需返回详单可 emit）
          await prisma.kioskDevice.update({
            where: { id: deviceId },
            data: { lastSeenAt: new Date() },
          });
          break;
        }
        case "DELIVERED": {
          // 送达 ACK：把 FeedbackSession -> DELIVERED（吸收你 ws 版“ack 落库”）
          const sid = msg.payload?.sessionId;
          if (sid) {
            await prisma.feedbackSession.updateMany({
              where: { id: sid, deviceId, status: "CREATED" },
              data: { status: "DELIVERED", deliveredAt: new Date() },
            });
          }
          break;
        }
        case "FEEDBACK_UPDATE": {
          // 设备端额外上报（日志/进度）
          // 这里留空或写入审计表
          break;
        }
        default:
          // ignore
          break;
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
