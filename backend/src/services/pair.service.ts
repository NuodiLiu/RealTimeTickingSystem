import crypto from 'crypto';
import { prisma } from "../lib/prisma";
import { BadRequestError, MissingFieldError } from "../error";
import { DeviceMode } from '../lib/utils/type';

export class PairService {
  // generate qr for kiosk
  static async generateQR() {
    const pairingToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    const session = await prisma.pairingSession.create({
      data: {
        pairingToken,
        expiresAt,
        status: 'PENDING',
      },
    });

    const apiBase = process.env.API_BASE_URL || 'http://localhost:3000';
    const qrData = { pairingToken, apiEndpoint: apiBase };
    const qrUrl = `${apiBase}/pair?data=${encodeURIComponent(JSON.stringify(qrData))}`;

    return { qrUrl, pairingToken, sessionId: session.id, expiresAt };
  }

  // ipad scans qr, completes pairing
  static async completePairing(data: {
    pairingToken: string;
    deviceName: string;
    deviceMode?: DeviceMode;
  }) {
    const { pairingToken, deviceName, deviceMode = 'FEEDBACK' } = data;

    if (!pairingToken || !deviceName) {
      throw new MissingFieldError(['pairingToken', 'deviceName']);
    }

    const session = await prisma.pairingSession.findUnique({
      where: { pairingToken },
    });

    if (!session || session.status !== 'PENDING' || session.expiresAt < new Date()) {
      throw new BadRequestError('Invalid or expired pairing token');
    }

    const deviceSecret = crypto.randomBytes(32).toString('hex');
    const secretHash = crypto.createHash('sha256').update(deviceSecret).digest('hex');

    const device = await prisma.kioskDevice.create({
      data: {
        name: deviceName,
        secretHash,
        mode: deviceMode,
        lastSeenAt: new Date(),
      },
    });

    // update pairing session
    await prisma.pairingSession.update({
      where: { id: session.id },
      data: {
        status: 'COMPLETED',
        deviceId: device.id,
        completedAt: new Date(),
      },
    });

    return {
      deviceId: device.id,
      deviceSecret,
      deviceName: device.name,
      deviceMode: device.mode,
      wsEndpoint: `${process.env.WS_BASE_URL || 'ws://localhost:3000'}/ws`,
    };
  }
}