import http from 'http';
import express from 'express';
import { io as Client, Socket } from 'socket.io-client';

import { DeviceGateway } from '../../src/websocket/deviceSocket'; // ← 调整为你的路径
import { bindRealtime } from '../../src/websocket';               // ← 调整为你的路径
import { signDeviceToken } from '../../src/websocket/auth';       // ← 调整为你的路径

// 仅 mock 鉴权/上线所需的最小 prisma
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

jest.setTimeout(25000);

describe('WebSocket reconnect matrix: server-kick / network-loss / cold-start', () => {
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
    (prisma.kioskDevice.findUnique as jest.Mock).mockImplementation(async ({ where }: any) => {
      // 所有用例都基于 dev-1 / FEEDBACK
      if (where.id === 'dev-1') return { id: 'dev-1', mode: 'FEEDBACK' };
      return null;
    });
    (prisma.kioskDevice.update as jest.Mock).mockResolvedValue({});
  });

  function connectClient(reconnect = true) {
    const token = signDeviceToken('dev-1', 'FEEDBACK');
    const sock = Client(baseURL, {
      path: '/ws',
      transports: ['websocket'],
      forceNew: true,
      reconnection: reconnect,
      reconnectionAttempts: 20,
      reconnectionDelay: 100,
      reconnectionDelayMax: 400,
      auth: { deviceToken: token },
    });
    return sock;
  }

  async function waitConnect(socket: Socket, label = 'connect', timeout = 4000) {
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`${label} timeout`)), timeout);
      socket.once('connect', () => { clearTimeout(t); resolve(); });
      socket.once('connect_error', (err) => { clearTimeout(t); reject(err); });
    });
  }

  async function closeClient(socket: Socket) {
    await new Promise<void>((resolve) => {
      socket.once('close', () => resolve());
      socket.close();
      setTimeout(resolve, 200);
    });
  }

  it('A) server kicks (io server disconnect) → client handles by manual connect()', async () => {
    const client = connectClient(true);
    const received: any[] = [];
    client.on('message', (m) => received.push(m));
    await waitConnect(client, 'initial connect');

    // 监听 disconnect，服务器踢下线时 reason 为 'io server disconnect'，手动 connect()
    client.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') {
        client.connect(); // 手动重连
      }
    });

    // 清空初始 PING
    received.length = 0;

    // 服务器踢下线：断开房间内 socket
    const room = 'device:dev-1';
    const sockets = await ioServer.in(room).fetchSockets();
    expect(sockets.length).toBeGreaterThan(0);
    sockets.forEach((s) => s.disconnect(true));

    // 等待重连（依赖上面的手动 client.connect()）
    await waitConnect(client, 'reconnect after server kick', 7000);

    // 重连后推送一条消息，应能收到
    received.length = 0;
    const payload = {
      sessionId: 'sess-kick-reconnected',
      caseId: 'case-1',
      staff: { id: 'st-1', name: 'Alice' },
      expireAt: new Date().toISOString(),
    };
    DeviceGateway.publish('dev-1', { type: 'SHOW_FEEDBACK', payload });
    await new Promise((r) => setTimeout(r, 200));
    expect(received.some((m) => m?.type === 'SHOW_FEEDBACK' && m?.payload?.sessionId === 'sess-kick-reconnected')).toBe(true);

    await closeClient(client);
  });

  it('B) network loss (transport close) → auto reconnection without manual connect()', async () => {
    const client = connectClient(true); // 自动重连启用
    const received: any[] = [];
    client.on('message', (m) => received.push(m));
    await waitConnect(client, 'initial connect');

    received.length = 0;

    // 模拟网络层断开：关闭底层传输（不要用 socket.disconnect()）
    // 这会触发 'transport close'，Socket.IO 会自动重连
    // 注意：访问私有属性仅用于测试
    const anyClient: any = client as any;
    anyClient.io.engine.transport.ws?.close?.();        // WebSocket transport
    anyClient.io.engine.close?.();                      // 兜底：engine 关闭

    await waitConnect(client, 'reconnect after transport close', 7000);

    // 重连后推送，应该能收到
    received.length = 0;
    const payload = {
      sessionId: 'sess-net-reconnected',
      caseId: 'case-2',
      staff: { id: 'st-1', name: 'Alice' },
      expireAt: new Date().toISOString(),
    };
    DeviceGateway.publish('dev-1', { type: 'SHOW_FEEDBACK', payload });
    await new Promise((r) => setTimeout(r, 200));
    expect(received.some((m) => m?.type === 'SHOW_FEEDBACK' && m?.payload?.sessionId === 'sess-net-reconnected')).toBe(true);

    await closeClient(client);
  });

  it('C) cold start (app killed) → new Socket instance connects and receives messages', async () => {
    // 冷启动 = 上一个实例彻底销毁，再用同 token 新建实例
    const client1 = connectClient(false); // 不需要自动重连
    await waitConnect(client1, 'client1 connect');

    // 模拟 App 退出：完全关闭 client1
    await closeClient(client1);

    // 新建实例：冷启动重新创建 socket 并连接
    const client2 = connectClient(true);
    const received2: any[] = [];
    client2.on('message', (m) => received2.push(m));
    await waitConnect(client2, 'client2 connect');

    // 推送消息，新实例应能收到
    received2.length = 0;
    const payload = {
      sessionId: 'sess-coldstart',
      caseId: 'case-3',
      staff: { id: 'st-1', name: 'Alice' },
      expireAt: new Date().toISOString(),
    };
    DeviceGateway.publish('dev-1', { type: 'SHOW_FEEDBACK', payload });
    await new Promise((r) => setTimeout(r, 200));
    expect(received2.some((m) => m?.type === 'SHOW_FEEDBACK' && m?.payload?.sessionId === 'sess-coldstart')).toBe(true);

    await closeClient(client2);
  });
});
