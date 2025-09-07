// tests/websocket/ws.connection.test.ts
import http from 'http';
import express from 'express';
import { io as Client, Socket } from 'socket.io-client';

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
import { DeviceGateway } from '../../src/websocket/deviceSocket';
import { bindRealtime } from '../../src/websocket';
import { signDeviceToken } from '../../src/websocket/auth';

jest.setTimeout(15000); // 给 CI 稍微多一点余量

describe('Socket.IO device connection & auth', () => {
  let server: http.Server;
  let baseURL: string;
  let ioServer: ReturnType<typeof DeviceGateway.init>;
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

    // 初始化 Socket.IO 并绑定实时逻辑
    ioServer = DeviceGateway.init(server);
    bindRealtime(ioServer);

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    baseURL = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    process.env = ORIGINAL_ENV;

    // 确保关闭 client 与 io，避免 afterAll 超时
    try { client?.close(); } catch {}
    await new Promise<void>((resolve) => {
      // 先关闭 io（这会断开所有 socket）
      ioServer.close(() => resolve());
    });

    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // 每例确保没有旧 client
    if (client && client.connected) client.close();
    client = null;
  });

  function connectClient(token?: string) {
    // ✅ 使用展开语法省略可选属性，避免 exactOptionalPropertyTypes 报错
    const sock = Client(baseURL, {
      path: '/ws',
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
      ...(token ? { auth: { deviceToken: token } } : {}),
    });
    return sock;
  }

  it('rejects connection when deviceToken is missing/invalid', async () => {
    (prisma.kioskDevice.findUnique as jest.Mock).mockReset();

    client = connectClient(); // 不带 token

    const outcome = await new Promise<'connected' | 'connect_error'>((resolve) => {
      const t = setTimeout(() => resolve('connected'), 800);
      // 提前绑定事件（虽然这个用例无所谓）
      client!.on('connect', () => { clearTimeout(t); resolve('connected'); });
      client!.on('connect_error', () => { clearTimeout(t); resolve('connect_error'); });
    });

    expect(outcome).toBe('connect_error');

    client.close();
    client = null;
  });

  it('allows connection with valid deviceToken and sends initial PING', async () => {
    (prisma.kioskDevice.findUnique as jest.Mock).mockResolvedValue({
      id: 'dev-1',
      mode: 'DUAL',
    });
    (prisma.kioskDevice.update as jest.Mock).mockResolvedValue({}); // lastSeenAt 更新

    const token = signDeviceToken('dev-1', 'DUAL');

    client = connectClient(token);

    // ⬇️ 在等待 connect 之前就先挂上 message 监听，避免错过首次 PING
    const messages: any[] = [];
    client.on('message', (msg: any) => messages.push(msg));

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('connect timeout')), 3000);
      client!.on('connect', () => { clearTimeout(timer); resolve(); });
      client!.on('connect_error', (err) => { clearTimeout(timer); reject(err); });
    });

    // 等待最多 1s，直到收到 PING（服务器连接后立即发一条）
    const gotPing = await new Promise<boolean>((resolve) => {
      const deadline = Date.now() + 1000;
      const tick = () => {
        if (messages.some((m) => m?.type === 'PING')) return resolve(true);
        if (Date.now() > deadline) return resolve(false);
        setTimeout(tick, 20);
      };
      tick();
    });

    expect(gotPing).toBe(true);

    // bindRealtime 会在 connection 里更新 lastSeenAt
    expect(prisma.kioskDevice.update).toHaveBeenCalledTimes(1);
    expect(prisma.kioskDevice.update.mock.calls[0][0]).toMatchObject({
      where: { id: 'dev-1' },
      data: { lastSeenAt: expect.any(Date) },
    });

    client.close();
    client = null;
  });
});
