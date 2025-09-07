// tests/websocket/ws.device-inbound.test.ts
import http from 'http';
import express from 'express';
import { io as Client, Socket } from 'socket.io-client';

import { DeviceGateway } from '../../src/websocket/deviceSocket';   // ← 调整路径
import { bindRealtime } from '../../src/websocket';                 // ← 调整路径
import { signDeviceToken } from '../../src/websocket/auth';         // ← 调整路径

// ---- Mock prisma：仅用到 kioskDevice.update / findUnique & feedbackSession.updateMany ----
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

// ---- Mock addLeaseSeconds：验证被调用即可 ----
jest.mock('../../src/websocket/lease', () => ({
  addLeaseSeconds: jest.fn(async () => {}),
}));

import { addLeaseSeconds } from '../../src/websocket/lease';

jest.setTimeout(20000);

describe('WebSocket inbound messages (device → server)', () => {
  let server: http.Server;
  let ioServer: ReturnType<typeof DeviceGateway.init>;
  let baseURL: string;
  let client: Socket | null = null;

  const ORIGINAL_ENV = process.env;

  beforeAll(async () => {
    process.env = {
      ...ORIGINAL_ENV,
      JWT_SECRET: ORIGINAL_ENV.JWT_SECRET || 'test-secret',
      FRONTEND_URL: ORIGINAL_ENV.FRONTEND_URL || 'http://localhost:3001',
    };

    const app = express();
    server = http.createServer(app);

    ioServer = DeviceGateway.init(server); // path='/ws'
    bindRealtime(ioServer);

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    baseURL = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    process.env = ORIGINAL_ENV;

    if (client) {
      await new Promise<void>((resolve) => {
        client!.once('close', () => resolve());
        client!.close();
        setTimeout(resolve, 200);
      });
      client = null;
    }

    await new Promise<void>((resolve) => ioServer.close(() => resolve()));
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function mockDevice(id: string, mode: 'REGISTRATION' | 'FEEDBACK') {
    (prisma.kioskDevice.findUnique as jest.Mock).mockImplementation(async ({ where }: any) => {
      if (where.id === id) return { id, mode };
      return null;
    });
    (prisma.kioskDevice.update as jest.Mock).mockResolvedValue({});
  }

  function connectAs(deviceId: string, mode: 'REGISTRATION' | 'FEEDBACK', extra?: { headers?: Record<string, string> }) {
    const token = signDeviceToken(deviceId, mode);
    const sock = Client(baseURL, {
      path: '/ws',
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
      auth: { deviceToken: token },
      ...(extra?.headers ? { extraHeaders: extra.headers } : {}),
    });
    return sock;
  }

  it('handles PONG / STATUS / LEASE / DELIVERED correctly', async () => {
    mockDevice('dev-1', 'FEEDBACK');

    client = connectAs('dev-1', 'FEEDBACK');

    // 提前挂 message（可能会有 PING）
    const received: any[] = [];
    client.on('message', (m: any) => received.push(m));

    // 等连接成功
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('connect timeout')), 3000);
      client!.on('connect', () => { clearTimeout(t); resolve(); });
      client!.on('connect_error', reject);
    });

    // 忽略初始 PING
    received.length = 0;

    // 1) 设备发 PONG → should update lastSeenAt
    client.emit('message', { type: 'PONG' });
    await new Promise((r) => setTimeout(r, 50));
    expect(prisma.kioskDevice.update).toHaveBeenCalledTimes(2); 
    // 解释：一次来自连接时 bindRealtime 的 lastSeenAt 更新；一次来自 PONG

    // 2) 设备发 STATUS → should update lastSeenAt again
    client.emit('message', { type: 'STATUS' });
    await new Promise((r) => setTimeout(r, 50));
    expect(prisma.kioskDevice.update).toHaveBeenCalledTimes(3);

    // 3) 设备发 LEASE → should call addLeaseSeconds(deviceId, 30)
    await (addLeaseSeconds as jest.Mock).mockClear();
    client.emit('message', { type: 'LEASE' });
    await new Promise((r) => setTimeout(r, 50));
    expect(addLeaseSeconds).toHaveBeenCalledWith('dev-1', 30);

    // 4) 设备发 DELIVERED(sessionId) → feedbackSession.updateMany
    (prisma.feedbackSession.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    client.emit('message', { type: 'DELIVERED', payload: { sessionId: 'sess-abc' } });
    await new Promise((r) => setTimeout(r, 50));
    expect(prisma.feedbackSession.updateMany).toHaveBeenCalledWith({
      where: { id: 'sess-abc', deviceId: 'dev-1', status: 'CREATED' },
      data: { status: 'DELIVERED', deliveredAt: expect.any(Date) },
    });

    // 清理本例 client
    await new Promise<void>((resolve) => {
      client!.once('close', () => resolve());
      client!.close();
      setTimeout(resolve, 200);
    });
    client = null;
  });

  it('rejects connection when Origin is not allowed', async () => {
    // 你在 checkOrigin 里：allowed = FRONTEND_URL；若 origin 不以其开头则拒绝
    mockDevice('dev-x', 'FEEDBACK');

    const bad = connectAs('dev-x', 'FEEDBACK', { headers: { origin: 'http://evil.example.com' } });

    const outcome = await new Promise<'connected' | 'connect_error'>((resolve) => {
      const t = setTimeout(() => resolve('connected'), 800);
      bad.on('connect', () => { clearTimeout(t); resolve('connected'); });
      bad.on('connect_error', () => { clearTimeout(t); resolve('connect_error'); });
    });

    expect(outcome).toBe('connect_error');

    await new Promise<void>((resolve) => {
      bad.once('close', () => resolve());
      bad.close();
      setTimeout(resolve, 100);
    });
  });
});
