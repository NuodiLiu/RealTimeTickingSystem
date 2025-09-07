
import { BadRequestError, NotFoundError } from "../../error";
import crypto from "crypto";
import { prisma } from "../prisma";
export async function validateDeviceApiKey(authHeader: string) {
  // 期望格式：Authorization: Device <deviceId>:<deviceSecret>
  if (!authHeader?.startsWith('Device ')) {
    throw new BadRequestError('Missing or invalid Authorization header');
  }
  const token = authHeader.slice('Device '.length).trim(); // "<id>:<secret>"
  const sep = token.indexOf(':');
  if (sep <= 0) throw new BadRequestError('Invalid device credential format');

  const deviceId = token.slice(0, sep);
  const deviceSecret = token.slice(sep + 1);

  const device = await prisma.kioskDevice.findUnique({ where: { id: deviceId } });
  if (!device) throw new NotFoundError('Device not found');

  // 可选吊销检查：
  // if (device.disabledAt) throw new BadRequestError('Device disabled');

  const incoming = crypto.createHash('sha256').update(deviceSecret).digest();
  const stored = Buffer.from(device.secretHash, 'hex'); // 注意存 hash 的格式（hex/ base64）

  // 避免长度差异报错
  if (stored.length !== incoming.length) {
    throw new BadRequestError('Invalid device credentials');
  }
  if (!crypto.timingSafeEqual(stored, incoming)) {
    throw new BadRequestError('Invalid device credentials');
  }

  return { deviceId: device.id, device };
}