
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
 * Staff JWT payload structure for API access
 */
export type StaffJwtPayload = {
  typ: 'staff';
  sub: string; // staffId
  role: 'ADMIN' | 'STAFF';
  employeeNo: string;
  identityKey: string;
  name?: string;
  email?: string;
  iat?: number;
  exp?: number;
};

/**
 * Generate a short-lived JWT token for staff API access
 * Used after Azure AD authentication for API calls
 */
export function signStaffToken(staffData: {
  id: string;
  role: 'ADMIN' | 'STAFF';
  employeeNo: string;
  identityKey: string;
  name?: string;
  email?: string;
}): string {
  return jwt.sign(
    {
      typ: 'staff',
      sub: staffData.id,
      role: staffData.role,
      employeeNo: staffData.employeeNo,
      identityKey: staffData.identityKey,
      name: staffData.name,
      email: staffData.email,
    } as StaffJwtPayload,
    process.env.JWT_SECRET!,
    { expiresIn: '15m' } // Short-lived: 15 minutes
  );
}

/**
 * Verify and decode staff JWT token
 */
export function verifyStaffToken(token: string): StaffJwtPayload {
  return jwt.verify(token, process.env.JWT_SECRET!) as StaffJwtPayload;
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