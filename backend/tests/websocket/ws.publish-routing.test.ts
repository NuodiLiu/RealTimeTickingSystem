// tests/websocket/ws.publish-routing.test.ts
import http from 'http';
import express from 'express';
import { io as Client, Socket } from 'socket.io-client';

import { DeviceGateway } from '../../src/websocket/deviceSocket';
import { bindRealtime } from '../../src/websocket';
import { signDeviceToken } from '../../src/websocket/auth';

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

describe('Socket.IO publish routing (room: device:<id>)', () => {
  let server: http.Server;
  let ioServer: ReturnType<typeof DeviceGateway.init>;
  let baseURL: string;

  let c1: Socket | null = null;
  let c2: Socket | null = null;

  const ORIGINAL_ENV = process.env;

  beforeAll(async () => {
    process.env = {
      ...ORIGINAL_ENV,
      JWT_SECRET: ORIGINAL_ENV.JWT_SECRET || 'test-secret',
      FRONTEND_URL: ORIGINAL_ENV.FRONTEND_URL || 'http://localhost:3001',
    };

    const app = express();
    server = http.createServer(app);

    ioServer = DeviceGateway.init(server);
    bindRealtime(ioServer);

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    baseURL = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    process.env = ORIGINAL_ENV;

    const closeClient = (cli: Socket | null) =>
      cli
        ? new Promise<void>((resolve) => {
            cli.once('close', () => resolve());
            cli.close();
            setTimeout(resolve, 200);
          })
        : Promise.resolve();

    await closeClient(c1);
    await closeClient(c2);
    c1 = c2 = null;

    await new Promise<void>((resolve) => ioServer.close(() => resolve()));
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // 通用 mock：同时支持多个设备（REGISTRATION/FEEDBACK），不要在 connectClient 里再覆写
  function mockDevices(devs: Record<string, 'REGISTRATION' | 'FEEDBACK'>) {
    (prisma.kioskDevice.findUnique as jest.Mock).mockImplementation(async ({ where }: any) => {
      const mode = devs[where.id as string];
      return mode ? { id: where.id, mode } : null;
    });
    (prisma.kioskDevice.update as jest.Mock).mockResolvedValue({});
  }

  function connectClient(deviceId: string, mode: 'REGISTRATION' | 'FEEDBACK') {
    const token = signDeviceToken(deviceId, mode);
    return Client(baseURL, {
      path: '/ws',
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
      auth: { deviceToken: token },
    });
  }

  it('publishes only to the targeted device room', async () => {
    // 一次性注册两个设备，避免被覆盖
    mockDevices({ 'dev-1': 'FEEDBACK', 'dev-2': 'REGISTRATION' });

    c1 = connectClient('dev-1', 'FEEDBACK');
    c2 = connectClient('dev-2', 'REGISTRATION');

    const msgs1: any[] = [];
    const msgs2: any[] = [];
    c1.on('message', (m: any) => msgs1.push(m));
    c2.on('message', (m: any) => msgs2.push(m));

    await Promise.all([
      new Promise<void>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('c1 connect timeout')), 3000);
        c1!.on('connect', () => { clearTimeout(t); resolve(); });
        c1!.on('connect_error', reject);
      }),
      new Promise<void>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('c2 connect timeout')), 3000);
        c2!.on('connect', () => { clearTimeout(t); resolve(); });
        c2!.on('connect_error', reject);
      }),
    ]);

    // 忽略连接初始 PING
    msgs1.length = 0;
    msgs2.length = 0;

    const payload = {
      sessionId: 'sess-1',
      caseId: 'case-1',
      staff: { id: 'st-1', name: 'Alice' },
      expireAt: new Date().toISOString(),
    };

    // 发给 dev-1
    DeviceGateway.publish('dev-1', { type: 'SHOW_FEEDBACK', payload });

    await new Promise((r) => setTimeout(r, 200));

    const got1 = msgs1.some((m) => m?.type === 'SHOW_FEEDBACK' && m?.payload?.sessionId === 'sess-1');
    const got2 = msgs2.some((m) => m?.type === 'SHOW_FEEDBACK' && m?.payload?.sessionId === 'sess-1');

    expect(got1).toBe(true);
    expect(got2).toBe(false);

    // 连接时更新 lastSeenAt（两设备各一次）
    expect(prisma.kioskDevice.update).toHaveBeenCalled();
    const ids = (prisma.kioskDevice.update as jest.Mock).mock.calls.map((c: any[]) => c[0].where.id);
    expect(ids).toEqual(expect.arrayContaining(['dev-1', 'dev-2']));

    // 关闭 client，避免 open handles
    await new Promise<void>((resolve) => { c1!.once('close', () => resolve()); c1!.close(); setTimeout(resolve, 200); });
    await new Promise<void>((resolve) => { c2!.once('close', () => resolve()); c2!.close(); setTimeout(resolve, 200); });
    c1 = c2 = null;
  });
});
