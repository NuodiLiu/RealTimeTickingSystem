// tests/websocket/ws.lease-extend.test.ts
import http from 'http';
import express from 'express';
import { io as Client, Socket } from 'socket.io-client';

import { DeviceGateway } from '../../src/websocket/deviceSocket'; // ← 调整路径
import { bindRealtime } from '../../src/websocket';               // ← 调整路径
import { signDeviceToken } from '../../src/websocket/auth';       // ← 调整路径

// mock prisma（鉴权、上线刷新、锁查询&更新）
jest.mock('../../src/lib/prisma', () => ({
  prisma: {
    kioskDevice: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    kioskLock: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    feedbackSession: {
      updateMany: jest.fn(),
    },
  },
}));
import { prisma } from '../../src/lib/prisma';

jest.setTimeout(20000);

describe('WebSocket LEASE: extends active lock leaseExpireAt by 30s', () => {
  let server: http.Server;
  let ioServer: ReturnType<typeof DeviceGateway.init>;
  let baseURL: string;
  let client: Socket | null = null;

  const ORIGINAL_ENV = process.env;
  const REAL_NOW = Date.now;

  beforeAll(async () => {
    process.env = {
      ...ORIGINAL_ENV,
      JWT_SECRET: ORIGINAL_ENV.JWT_SECRET || 'test-secret',
      FRONTEND_URL: ORIGINAL_ENV.FRONTEND_URL || 'http://localhost:3001',
    };

    const app = express();
    server = http.createServer(app);

    ioServer = DeviceGateway.init(server); // path '/ws'
    bindRealtime(ioServer);

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    baseURL = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    process.env = ORIGINAL_ENV;
    // 关 client
    if (client) {
      await new Promise<void>((resolve) => {
        client!.once('close', () => resolve());
        client!.close();
        setTimeout(resolve, 200);
      });
      client = null;
    }
    // 关 io / http
    await new Promise<void>((resolve) => ioServer.close(() => resolve()));
    await new Promise<void>((resolve) => server.close(() => resolve()));
    // 还原 Date.now
    (Date.now as any) = REAL_NOW;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // 设备鉴权
    (prisma.kioskDevice.findUnique as jest.Mock).mockImplementation(async ({ where }: any) => {
      if (where.id === 'dev-1') return { id: 'dev-1', mode: 'FEEDBACK' };
      return null;
    });
    (prisma.kioskDevice.update as jest.Mock).mockResolvedValue({});
  });

  function connectDev1() {
    const token = signDeviceToken('dev-1', 'FEEDBACK');
    return Client(baseURL, {
      path: '/ws',
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
      auth: { deviceToken: token },
    });
  }

  async function ensureConnected(sock: Socket) {
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('connect timeout')), 3000);
      sock.on('connect', () => { clearTimeout(t); resolve(); });
      sock.on('connect_error', reject);
    });
  }

  it('extends from existing future leaseExpireAt (adds +30s to current lease)', async () => {
    // 固定当前时间
    const T0 = new Date('2025-09-05T00:00:00.000Z').getTime();
    jest.spyOn(Date, 'now').mockReturnValue(T0);

    // 锁还未过期：当前 lease = T0 + 120s
    const leaseExpireAt = new Date(T0 + 120_000); // +2min
    (prisma.kioskLock.findFirst as jest.Mock).mockResolvedValue({
      id: 'lock-1',
      leaseExpireAt,
      status: 'ACTIVE',
      deviceId: 'dev-1',
    });

    (prisma.kioskLock.update as jest.Mock).mockResolvedValue({});

    client = connectDev1();
    await ensureConnected(client);

    // 发送 LEASE
    client.emit('message', { type: 'LEASE' });
    await new Promise((r) => setTimeout(r, 80));

    // 期望 newExpire = 原 lease + 30s
    const expected = new Date(leaseExpireAt.getTime() + 30_000);

    expect(prisma.kioskLock.update).toHaveBeenCalledTimes(1);
    expect((prisma.kioskLock.update as jest.Mock).mock.calls[0][0]).toMatchObject({
      where: { id: 'lock-1' },
      data: {
        leaseExpireAt: expected,
        version: { increment: 1 },
      },
    });

    // 清理 client（避免句柄泄漏）；下面用例会重连新的
    await new Promise<void>((resolve) => {
      client!.once('close', () => resolve());
      client!.close();
      setTimeout(resolve, 150);
    });
    client = null;
  });

  it('extends from now when lease already expired (uses Date.now() + 30s)', async () => {
    // 固定当前时间
    const T0 = new Date('2025-09-05T01:23:45.000Z').getTime();
    (Date.now as any) = jest.fn(() => T0);

    // 锁已过期：当前 lease = T0 - 10s
    const leaseExpireAt = new Date(T0 - 10_000);
    (prisma.kioskLock.findFirst as jest.Mock).mockResolvedValue({
      id: 'lock-2',
      leaseExpireAt,
      status: 'ACTIVE',
      deviceId: 'dev-1',
    });

    (prisma.kioskLock.update as jest.Mock).mockResolvedValue({});

    client = connectDev1();
    await ensureConnected(client);

    // 发送 LEASE
    client.emit('message', { type: 'LEASE' });
    await new Promise((r) => setTimeout(r, 80));

    // 期望 newExpire = now + 30s
    const expected = new Date(T0 + 30_000);

    expect(prisma.kioskLock.update).toHaveBeenCalledTimes(1);
    const call = (prisma.kioskLock.update as jest.Mock).mock.calls[0][0];
    expect(call.where).toEqual({ id: 'lock-2' });
    expect(call.data.version).toEqual({ increment: 1 });
    expect(call.data.leaseExpireAt instanceof Date).toBe(true);
    expect((call.data.leaseExpireAt as Date).toISOString()).toBe(expected.toISOString());

    // 关闭 client
    await new Promise<void>((resolve) => {
      client!.once('close', () => resolve());
      client!.close();
      setTimeout(resolve, 150);
    });
    client = null;
  });
});
