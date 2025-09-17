import type { Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";

type DeviceJwt = { typ?: string; sub: string; mode?: string; iat?: number; exp?: number };
type StaffJwt = { typ?: string; sub: string; iat?: number; exp?: number };

export async function verifyDeviceHandshake(socket: Socket): Promise<{ deviceId: string; mode: string; }> {
  const bearer = String(socket.handshake.headers.authorization || "");
  const fromHeader = bearer.replace(/^Bearer\s+/i, "");
  const fromAuth =
    (socket.handshake.auth?.deviceToken as string | undefined) ??
    (socket.handshake.auth?.token as string | undefined);

  const token = fromAuth || fromHeader;
  if (!token) throw new Error("Missing device token");

  let payload: DeviceJwt;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET!) as DeviceJwt;
  } catch {
    throw new Error("Invalid device token");
  }

  if (!payload?.sub || payload.typ !== 'device') {
    throw new Error("Invalid device token payload");
  }

  const device = await prisma.kioskDevice.findUnique({
    where: { id: payload.sub },
    select: { id: true, mode: true },
  });
  if (!device) throw new Error("Device not found");

  return { deviceId: device.id, mode: device.mode as string };
}

// handle both device and dashboard connections
export async function verifySocketHandshake(socket: Socket): Promise<{ type: 'device' | 'dashboard'; deviceId?: string; mode?: string; userId?: string; }> {
  const bearer = String(socket.handshake.headers.authorization || "");
  const fromHeader = bearer.replace(/^Bearer\s+/i, "");
  const fromAuth =
    (socket.handshake.auth?.deviceToken as string | undefined) ??
    (socket.handshake.auth?.token as string | undefined);

  const token = fromAuth || fromHeader;
  
  if (!token) {
    return { type: 'dashboard' };
  }

  let payload: DeviceJwt | StaffJwt;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET!) as DeviceJwt | StaffJwt;
  } catch {
    return { type: 'dashboard' };
  }

  if (payload.typ === 'device') {
    const devicePayload = payload as DeviceJwt;
    if (!devicePayload.sub) {
      throw new Error("Invalid device token payload");
    }

    const device = await prisma.kioskDevice.findUnique({
      where: { id: devicePayload.sub },
      select: { id: true, mode: true },
    });
    if (!device) throw new Error("Device not found");

    return { 
      type: 'device', 
      deviceId: device.id, 
      mode: device.mode as string 
    };
  } else {
    return { type: 'dashboard', userId: payload.sub };
  }
}

export function signDeviceToken(deviceId: string, mode: string) {
  return jwt.sign({ sub: deviceId, mode, typ: "device" }, process.env.JWT_SECRET!, { expiresIn: "30d" });
}
