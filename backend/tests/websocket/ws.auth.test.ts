// tests/websocket/ws.auth-invalid.test.ts
import http from 'http';
import express from 'express';
import { io as Client, Socket } from 'socket.io-client';

import { DeviceGateway } from '../../src/websocket/deviceSocket'; // ← 按需调整
import { bindRealtime } from '../../src/websocket';               // ← 按需调整

// 仅 mock 鉴权回查需要的 prisma（不会被真正调用，因为鉴权前就拦截了）
jest.mock('../../src/lib/prisma', () => ({
  prisma: {
    kioskDevice: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));
import { prisma } from '../../src/lib/prisma';

jest.setTimeout(15000);

describe('WebSocket auth: missing / invalid deviceToken', () => {
  let server: http.Server;
  let ioServer: ReturnType<typeof DeviceGateway.init>;
  let baseURL: string;

  const ORIGINAL_ENV = process.env;

  beforeAll(async () => {
    process.env = {
      ...ORIGINAL_ENV,
      JWT_SECRET: ORIGINAL_ENV.JWT_SECRET || 'test-secret',  // verifyDeviceHandshake 会用到
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
  });

  function connectClient(opts?: { token?: string; origin?: string }) {
    const cfg: any = {
      path: '/ws',
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    };
    if (opts?.token) cfg.auth = { deviceToken: opts.token };
    if (opts?.origin) cfg.extraHeaders = { origin: opts.origin };
    return Client(baseURL, cfg);
  }

  async function expectConnectError(socket: Socket, label = 'connect_error', timeout = 2000) {
    const outcome = await new Promise<'ok' | 'err'>((resolve) => {
      const t = setTimeout(() => resolve('ok'), timeout);
      socket.once('connect', () => { clearTimeout(t); resolve('ok'); });
      socket.once('connect_error', () => { clearTimeout(t); resolve('err'); });
    });
    expect(outcome).toBe('err');
  }

  it('rejects when deviceToken is missing', async () => {
    const client = connectClient(); // 不带 auth.deviceToken
    await expectConnectError(client, 'missing token');

    // 未通过鉴权，不应有任何 socket 存活、也不会更新 lastSeenAt
    expect(ioServer.sockets.sockets.size).toBe(0);
    expect(prisma.kioskDevice.update).not.toHaveBeenCalled();

    await new Promise<void>((resolve) => {
      client.once('close', () => resolve());
      client.close();
      setTimeout(resolve, 100);
    });
  });

  it('rejects when deviceToken is invalid (bad JWT)', async () => {
    const client = connectClient({ token: 'not-a-valid-jwt' });
    await expectConnectError(client, 'invalid token');

    expect(ioServer.sockets.sockets.size).toBe(0);
    expect(prisma.kioskDevice.update).not.toHaveBeenCalled();

    await new Promise<void>((resolve) => {
      client.once('close', () => resolve());
      client.close();
      setTimeout(resolve, 100);
    });
  });
});
