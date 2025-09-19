
import { BadRequestError, NotFoundError, AuthError } from "../../error";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { prisma } from "../prisma";

/**
 * Device JWT payload structure for WebSocket/SignalR connections
 */
export type DeviceJwtPayload = {
  typ: 'device';
  sub: string; // deviceId
  mode: string; // device mode
  iat?: number;
  exp?: number;
};

/**
 * Generate a JWT token for device authentication
 * Used for device WebSocket/SignalR connections
 */
export function signDeviceToken(deviceId: string, mode: string): string {
  return jwt.sign(
    { sub: deviceId, mode, typ: "device" } as DeviceJwtPayload, 
    process.env.JWT_SECRET!, 
    { expiresIn: "30d" }
  );
}

/**
 * Validate device API key from Authorization header (HTTP API)
 * Format: Authorization: Device <deviceId>:<deviceSecret>
 */
export async function validateDeviceApiKey(authHeader: string) {
  // format: Authorisation: Device <deviceId>:<deviceSecret>
  if (!authHeader?.startsWith('Device ')) {
    throw new BadRequestError('Missing or invalid Authorisation header');
  }
  const token = authHeader.slice('Device '.length).trim(); // "<id>:<secret>"
  const sep = token.indexOf(':');
  if (sep <= 0) throw new BadRequestError('Invalid device credential format');

  const deviceId = token.slice(0, sep);
  const deviceSecret = token.slice(sep + 1);

  const device = await prisma.kioskDevice.findUnique({ where: { id: deviceId } });
  if (!device) throw new NotFoundError('Device not found');


  const incoming = crypto.createHash('sha256').update(deviceSecret).digest();
  const stored = Buffer.from(device.secretHash, 'hex'); // hash format（hex/ base64）

  if (stored.length !== incoming.length) {
    throw new BadRequestError('Invalid device credentials');
  }
  if (!crypto.timingSafeEqual(stored, incoming)) {
    throw new BadRequestError('Invalid device credentials');
  }

  return { deviceId: device.id, device };
}