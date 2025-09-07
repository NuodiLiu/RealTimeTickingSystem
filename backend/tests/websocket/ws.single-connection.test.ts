// tests/websocket/ws.single-connection.test.ts
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
  },
}));
import { prisma } from '../../src/lib/prisma';

jest.setTimeout(20000);

describe('WebSocket: same device re-connect kicks old socket', () => {
  let server: http.Server;
  let ioServer: ReturnType<typeof DeviceGateway.init>;
  let baseURL: string;
  let c1: Socket | null = null;
  let c2: Socket | null = null;

  beforeAll(async () => {
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

  function connect(deviceId: string) {
    const token = signDeviceToken(deviceId, 'FEEDBACK');
    return Client(baseURL, {
      path: '/ws',
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
      auth: { deviceToken: token },
    });
  }

  it('second connection replaces the first one', async () => {
    // 第一个连接
    c1 = connect('dev-1');
    await new Promise<void>((resolve, reject) => {
      c1!.on('connect', () => resolve());
      c1!.on('connect_error', reject);
    });

    let disconnected = false;
    c1.on('disconnect', () => { disconnected = true; });

    // 第二个连接（同一个 deviceId）
    c2 = connect('dev-1');
    await new Promise<void>((resolve, reject) => {
      c2!.on('connect', () => resolve());
      c2!.on('connect_error', reject);
    });

    // 等待踢掉旧连接
    await new Promise((r) => setTimeout(r, 200));

    expect(c2.connected).toBe(true);
    expect(disconnected).toBe(true);

    // 房间里只应剩一个 socket
    const sockets = await ioServer.in('device:dev-1').fetchSockets();
    expect(sockets.length).toBe(1);
  });
});
