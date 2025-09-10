import crypto from 'crypto';
import { prisma } from "../lib/prisma";
import { BadRequestError, MissingFieldError } from "../error";
import { DeviceMode } from '../lib/utils/type';
import { signDeviceToken } from '../websocket/auth';

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

    // DEV CODE
    if (process.env.NODE_ENV === 'development') {
      await prisma.pairingSession.upsert({
        where: { pairingToken: 'test-token-123' },
        update: {
          expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1h valid
          status: 'PENDING',
        },
        create: {
          pairingToken: 'test-token-123',
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          status: 'PENDING',
        },
      });
    }

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

    // In development, allow test-token-123 to be reused
    const isTestToken = process.env.NODE_ENV === 'development' && pairingToken === 'test-token-123';
    
    if (!session) {
      throw new BadRequestError('Invalid or expired pairing token');
    }
    
    // For test token, allow reuse even if expired or completed
    if (isTestToken && (session.status === 'COMPLETED' || session.expiresAt < new Date())) {
      // Reset the test token for reuse
      await prisma.pairingSession.update({
        where: { id: session.id },
        data: {
          status: 'PENDING',
          deviceId: null,
          completedAt: null,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000), // Extend expiry
        },
      });
    } else if (!isTestToken && (session.expiresAt < new Date() || session.status !== 'PENDING')) {
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

    // Generate WebSocket token for device
    const wsToken = signDeviceToken(device.id, deviceMode);

    // update pairing session (but keep test token reusable in development)
    if (!isTestToken) {
      await prisma.pairingSession.update({
        where: { id: session.id },
        data: {
          status: 'COMPLETED',
          deviceId: device.id,
          completedAt: new Date(),
        },
      });
    }

    return {
      deviceId: device.id,
      deviceSecret,
      apiKey: `${device.id}:${deviceSecret}`, // Combined for Authorization header
      wsToken, // JWT token for WebSocket authentication
      deviceName: device.name,
      deviceMode: device.mode,
      wsEndpoint: `${process.env.WS_BASE_URL || 'ws://localhost:3000'}/ws`,
    };
  }
}