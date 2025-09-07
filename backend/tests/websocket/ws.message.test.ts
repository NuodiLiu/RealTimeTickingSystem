// tests/websocket/ws.message-invalid.test.ts
import http from 'http';
import express from 'express';
import { io as Client, Socket } from 'socket.io-client';

import { DeviceGateway } from '../../src/websocket/deviceSocket'; // ← 调整路径
import { bindRealtime } from '../../src/websocket';               // ← 调整路径
import { signDeviceToken } from '../../src/websocket/auth';       // ← 调整路径

// 仅 mock 鉴权/上线刷新所需的 prisma
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

jest.setTimeout(15000);

describe('WebSocket: invalid/unknown device messages are ignored safely', () => {
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

    ioServer = DeviceGateway.init(server); // path '/ws'
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
        setTimeout(resolve, 150);
      });
      client = null;
    }

    await new Promise<void>((resolve) => ioServer.close(() => resolve()));
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.kioskDevice.findUnique as jest.Mock).mockImplementation(async ({ where }: any) => {
      if (where.id === 'dev-1') return { id: 'dev-1', mode: 'FEEDBACK' };
      return null;
    });
    (prisma.kioskDevice.update as jest.Mock).mockResolvedValue({});
  });

  function connectAsDev1() {
    const token = signDeviceToken('dev-1', 'FEEDBACK');
    const sock = Client(baseURL, {
      path: '/ws',
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
      auth: { deviceToken: token },
    });
    return sock;
  }

  it('ignores unknown message types without extra DB writes or crashes', async () => {
    client = connectAsDev1();

    // 连接成功
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('connect timeout')), 3000);
      client!.on('connect', () => { clearTimeout(t); resolve(); });
      client!.on('connect_error', reject);
    });

    // 连接时会做一次 lastSeenAt 更新
    const initialUpdateCalls = (prisma.kioskDevice.update as jest.Mock).mock.calls.length;
    expect(initialUpdateCalls).toBeGreaterThanOrEqual(1);

    // 发一些非法/未知消息
    client.emit('message', { type: 'UNKNOWN_EVENT', foo: 'bar' });
    client.emit('message', { notype: true });              // 缺 type
    client.emit('message', null as any);                   // null
    client.emit('message', 42 as any);                     // 非对象
    client.emit('message', { type: 'PONG', extra: 1 });    // 合法类型也测试一下路径
    client.emit('message', { type: 'UNKNOWN_EVENT_2' });

    // 给服务端一点处理时间
    await new Promise((r) => setTimeout(r, 100));

    // 断言：不会因非法消息额外写 DB（除了 PONG/STATUS 正常路径外）
    // 我们只验证：非法消息不会导致异常 & 不会触发 feedbackSession/kioskLock 的写
    expect(prisma.feedbackSession.updateMany).not.toHaveBeenCalled();
    // 如果你的 addLeaseSeconds 在别处被 mock，可一并断言未调用；此处不引入即可。

    // kioskDevice.update 可能因 PONG 正常+1；因此只校验“没有爆量写入”
    const afterCalls = (prisma.kioskDevice.update as jest.Mock).mock.calls.length;
    expect(afterCalls - initialUpdateCalls).toBeLessThanOrEqual(1); // 最多一次来自 PONG

    // 仍保持连接不中断
    expect(client.connected).toBe(true);
  });
});
