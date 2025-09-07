import type { Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";

type DeviceJwt = { sub: string; mode: string; typ: "device"; };

export async function verifyDeviceHandshake(socket: Socket): Promise<{ deviceId: string; mode: string; }> {
  // —— 只信 token（与你 ws 版修正一致）——
  const token = (socket.handshake.auth?.deviceToken ||
                 (socket.handshake.headers.authorization || "").replace(/^Bearer\s+/i, "")) as string | undefined;

  if (!token) throw new Error("Missing deviceToken");

  const payload = jwt.verify(token, process.env.JWT_SECRET!) as DeviceJwt;
  if (payload.typ !== "device" || !payload.sub) throw new Error("Invalid token");

  // 可选回查 DB 获取最新 mode/存在性
  const device = await prisma.kioskDevice.findUnique({
    where: { id: payload.sub },
    select: { id: true, mode: true },
  });
  if (!device) throw new Error("Device not found");

  return { deviceId: device.id, mode: device.mode };
}

// 与你 ws 版一致：生成 token 的函数（在配对/注册成功后发给设备端）
export function signDeviceToken(deviceId: string, mode: string) {
  return jwt.sign({ sub: deviceId, mode, typ: "device" }, process.env.JWT_SECRET!, { expiresIn: "30d" });
}
