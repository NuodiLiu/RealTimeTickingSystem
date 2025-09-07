// tests/websocket/ws.gateway-broadcasts.test.ts
import http from 'http';
import express from 'express';
import { io as Client, Socket } from 'socket.io-client';

import { DeviceGateway } from '../../src/websocket/deviceSocket'; // ← 调整为你的真实路径
import { bindRealtime } from '../../src/websocket';               // ← 调整为你的真实路径
import { signDeviceToken } from '../../src/websocket/auth';       // ← 调整为你的真实路径

// 仅 mock 连接鉴权/上线刷新所需的 prisma
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

describe('DeviceGateway helpers: notifyFeedback / dismiss / lockAssigned', () => {
  let server: http.Server;
  let ioServer: ReturnType<typeof DeviceGateway.init>;
  let baseURL: string;

  const ORIGINAL_ENV = process.env;

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
    await new Promise<void>((resolve) => ioServer.close(() => resolve()));
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // 通用：同时支持两个设备
    (prisma.kioskDevice.findUnique as jest.Mock).mockImplementation(async ({ where }: any) => {
      if (where.id === 'dev-1') return { id: 'dev-1', mode: 'FEEDBACK' };
      if (where.id === 'dev-2') return { id: 'dev-2', mode: 'REGISTRATION' };
      return null;
    });
    (prisma.kioskDevice.update as jest.Mock).mockResolvedValue({});
  });

  function connect(deviceId: 'dev-1' | 'dev-2', mode: 'FEEDBACK' | 'REGISTRATION') {
    const token = signDeviceToken(deviceId, mode);
    return Client(baseURL, {
      path: '/ws',
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
      auth: { deviceToken: token },
    });
  }

  async function connectBoth() {
    const c1 = connect('dev-1', 'FEEDBACK');
    const c2 = connect('dev-2', 'REGISTRATION');

    const msgs1: any[] = [];
    const msgs2: any[] = [];
    c1.on('message', (m: any) => msgs1.push(m));
    c2.on('message', (m: any) => msgs2.push(m));

    await Promise.all([
      new Promise<void>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('c1 connect timeout')), 3000);
        c1.on('connect', () => { clearTimeout(t); resolve(); });
        c1.on('connect_error', reject);
      }),
      new Promise<void>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('c2 connect timeout')), 3000);
        c2.on('connect', () => { clearTimeout(t); resolve(); });
        c2.on('connect_error', reject);
      }),
    ]);

    // 忽略初始 PING
    msgs1.length = 0;
    msgs2.length = 0;

    return { c1, c2, msgs1, msgs2 };
  }

  async function closeClient(cli: Socket | null) {
    if (!cli) return;
    await new Promise<void>((resolve) => {
      cli.once('close', () => resolve());
      cli.close();
      setTimeout(resolve, 150);
    });
  }

  it('notifyFeedback: only target device receives SHOW_FEEDBACK with payload', async () => {
    const { c1, c2, msgs1, msgs2 } = await connectBoth();

    const payload = {
      sessionId: 'sess-100',
      caseId: 'case-100',
      staff: { id: 'st-1', name: 'Alice' },
      expireAt: new Date('2025-09-05T00:10:00.000Z').toISOString(),
    };

    DeviceGateway.notifyFeedback('dev-1', payload);

    await new Promise((r) => setTimeout(r, 200));

    const got1 = msgs1.find(m => m?.type === 'SHOW_FEEDBACK' && m?.payload?.sessionId === 'sess-100');
    const got2 = msgs2.find(m => m?.type === 'SHOW_FEEDBACK' && m?.payload?.sessionId === 'sess-100');

    expect(got1).toBeTruthy();
    expect(got1.payload).toMatchObject(payload);
    expect(got2).toBeUndefined();

    await closeClient(c1);
    await closeClient(c2);
  });

  it('dismiss: only target device receives DISMISS', async () => {
    const { c1, c2, msgs1, msgs2 } = await connectBoth();

    DeviceGateway.dismiss('dev-1');

    await new Promise((r) => setTimeout(r, 200));

    const got1 = msgs1.some(m => m?.type === 'DISMISS');
    const got2 = msgs2.some(m => m?.type === 'DISMISS');

    expect(got1).toBe(true);
    expect(got2).toBe(false);

    await closeClient(c1);
    await closeClient(c2);
  });

  it('lockAssigned: only target device receives LOCK_ASSIGNED with payload', async () => {
    const { c1, c2, msgs1, msgs2 } = await connectBoth();

    const payload = {
      lockId: 'lock-xyz',
      version: 3,
      leaseExpireAt: new Date('2025-09-05T00:05:00.000Z').toISOString(),
      case: { id: 'case-7', studentName: 'Bob', category: 'General', status: 'IN_PROGRESS' },
      staffName: 'Alice',
    };

    DeviceGateway.lockAssigned('dev-1', payload);

    await new Promise((r) => setTimeout(r, 200));

    const got1 = msgs1.find(m => m?.type === 'LOCK_ASSIGNED' && m?.payload?.lockId === 'lock-xyz');
    const got2 = msgs2.find(m => m?.type === 'LOCK_ASSIGNED' && m?.payload?.lockId === 'lock-xyz');

    expect(got1).toBeTruthy();
    expect(got1.payload).toMatchObject(payload);
    expect(got2).toBeUndefined();

    await closeClient(c1);
    await closeClient(c2);
  });
});
